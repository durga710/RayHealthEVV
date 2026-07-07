/**
 * Command Center attention engine, pure, deterministic prioritization of what a
 * home-care agency owner must act on RIGHT NOW. Takes the agency operational
 * snapshot (all aggregated counts, no PHI) and returns a severity-ranked list of
 * attention items, each with a deep-link to the page that resolves it.
 *
 * Kept pure (no DB / IO) so it is fully unit-testable and so the same logic can
 * later feed an AI natural-language summary without re-deriving thresholds.
 */

import type {
  TodaysVisitOps,
  ExceptionResolutionCounts,
  AuthorizationOversightCounts,
  CredentialsComplianceCounts,
  ClaimMatchingCounts,
  PayrollReconciliationCounts,
} from '../repositories/compliance-engine-repository.js';

export type TodayVisitStatus = 'completed' | 'in_progress' | 'late' | 'upcoming';

/**
 * Classify a single scheduled visit for the Today board. Pure so it can be unit
 * tested and stays the single source of truth for the count buckets too:
 *   completed  → clocked out
 *   in_progress→ clocked in, not out
 *   late       → scheduled start passed (> grace) with no clock-in
 *   upcoming   → scheduled later, not started
 */
export function deriveTodayVisitStatus(
  v: { clockInTime: string | null; clockOutTime: string | null; scheduledStartTime: string | null },
  nowMs: number,
  graceMs = 15 * 60 * 1000,
): TodayVisitStatus {
  if (v.clockOutTime) return 'completed';
  if (v.clockInTime) return 'in_progress';
  const start = v.scheduledStartTime ? new Date(v.scheduledStartTime).getTime() : null;
  if (start !== null && nowMs > start + graceMs) return 'late';
  return 'upcoming';
}

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  /** Stable id so the UI can key / dedupe. */
  id: string;
  severity: AttentionSeverity;
  /** Short headline, e.g. "3 visits late to start". */
  title: string;
  /** One-line explanation of why it matters / what to do. */
  detail: string;
  /** The count driving this item (for sorting + display). */
  count: number;
  /** In-app route that resolves the item. */
  to: string;
}

/** Training rollup subset the command center consumes (from LearningAgencyRollup). */
export interface TrainingRollupInput {
  complianceRate: number;
  overdue: number;
  expired: number;
}

/** Coverage forecast subset the command center consumes (from CoverageForecast). */
export interface CoverageRollupInput {
  /** Upcoming recurring visits not yet generated into assignments. */
  totalGaps: number;
}

export interface CommandCenterSnapshot {
  today: TodaysVisitOps;
  exceptions: ExceptionResolutionCounts;
  authorizations: AuthorizationOversightCounts;
  credentials: CredentialsComplianceCounts;
  claims: ClaimMatchingCounts;
  payroll: PayrollReconciliationCounts;
  training: TrainingRollupInput;
  coverage: CoverageRollupInput;
}

const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Build the prioritized attention list. Items only appear when their driving
 * count is > 0, so a clean agency shows an empty list ("all clear"). Sorted by
 * severity (critical → warning → info), then by count descending.
 */
export function buildCommandCenterAttention(s: CommandCenterSnapshot): AttentionItem[] {
  const items: AttentionItem[] = [];
  const push = (item: AttentionItem): void => {
    if (item.count > 0) items.push(item);
  };

  // ── CRITICAL: today's no-show risk + lapsed compliance that blocks care ──
  push({
    id: 'visits-late-start',
    severity: 'critical',
    title: `${s.today.lateStart} visit${s.today.lateStart === 1 ? '' : 's'} late to start`,
    detail: 'Scheduled start passed with no clock-in. Confirm coverage now.',
    count: s.today.lateStart,
    to: '/admin/today',
  });
  push({
    id: 'credentials-expired',
    severity: 'critical',
    title: `${s.credentials.recentlyExpired} credential${s.credentials.recentlyExpired === 1 ? '' : 's'} expired`,
    detail: 'Caregivers with lapsed credentials should not be scheduled.',
    count: s.credentials.recentlyExpired,
    to: '/admin/compliance-engine/credentials',
  });

  // ── WARNING: things that will bite within days ──
  push({
    id: 'evv-exceptions-open',
    severity: 'warning',
    title: `${s.exceptions.openExceptions} open EVV exception${s.exceptions.openExceptions === 1 ? '' : 's'}`,
    detail: 'Unresolved exceptions block clean Sandata/HHAeXchange submission.',
    count: s.exceptions.openExceptions,
    to: '/admin/compliance-engine/exceptions',
  });
  push({
    id: 'credentials-expiring-30',
    severity: 'warning',
    title: `${s.credentials.expiringIn30d} credential${s.credentials.expiringIn30d === 1 ? '' : 's'} expiring in 30 days`,
    detail: 'Renew before they lapse to keep caregivers schedulable.',
    count: s.credentials.expiringIn30d,
    to: '/admin/compliance-engine/credentials',
  });
  push({
    id: 'authorizations-expired',
    severity: 'warning',
    title: `${s.authorizations.recentlyExpired} authorization${s.authorizations.recentlyExpired === 1 ? '' : 's'} expired`,
    detail: 'Visits against expired authorizations will not be reimbursed.',
    count: s.authorizations.recentlyExpired,
    to: '/admin/authorizations',
  });
  push({
    id: 'authorizations-expiring-14',
    severity: 'warning',
    title: `${s.authorizations.expiringIn14d} authorization${s.authorizations.expiringIn14d === 1 ? '' : 's'} expiring in 14 days`,
    detail: 'Request renewals from the payer before units run out.',
    count: s.authorizations.expiringIn14d,
    to: '/admin/authorizations',
  });
  push({
    id: 'training-overdue',
    severity: 'warning',
    title: `${s.training.overdue} overdue training assignment${s.training.overdue === 1 ? '' : 's'}`,
    detail: 'Overdue PA-required training is an audit and scheduling risk.',
    count: s.training.overdue,
    to: '/admin/learning',
  });
  push({
    id: 'visits-in-progress-stale',
    severity: 'warning',
    title: `${s.payroll.inProgressVisits} visit${s.payroll.inProgressVisits === 1 ? '' : 's'} still open`,
    detail: 'Clocked in but never clocked out, fix before payroll runs.',
    count: s.payroll.inProgressVisits,
    to: '/admin/review',
  });
  push({
    id: 'coverage-gaps',
    severity: 'warning',
    title: `${s.coverage.totalGaps} upcoming visit${s.coverage.totalGaps === 1 ? '' : 's'} not yet generated`,
    detail: 'Recurring patterns have visits not on the calendar, caregivers won’t see them.',
    count: s.coverage.totalGaps,
    to: '/admin/recurring-schedules',
  });

  // ── INFO: readiness signals worth a glance ──
  push({
    id: 'billing-flagged',
    severity: 'info',
    title: `${s.claims.flaggedVisitsLast7d} flagged visit${s.claims.flaggedVisitsLast7d === 1 ? '' : 's'} this week`,
    detail: 'Flagged visits need review before they can be billed.',
    count: s.claims.flaggedVisitsLast7d,
    to: '/admin/compliance-engine/claims',
  });

  return items.sort(
    (a, b) =>
      SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity] || b.count - a.count,
  );
}

/**
 * Build the prompt for an AI "daily briefing" over the command-center snapshot.
 * PURE and COUNT-ONLY, it never includes a client/caregiver name or any PHI,
 * only aggregate numbers and the already-derived attention list, so the briefing
 * carries no retention liability. Returns the system instruction + user prompt
 * for `askAI`; kept here (not in the route) so it's unit-testable and the
 * guardrails live with the rules they describe.
 */
export function buildBriefingPrompt(s: CommandCenterSnapshot): {
  system: string;
  prompt: string;
} {
  const attention = buildCommandCenterAttention(s);

  const system =
    'You are the operations briefing assistant for a Pennsylvania home-care agency ' +
    'admin console. Given today\'s aggregate operational numbers, write a short, ' +
    'plain-English briefing (3-5 sentences, no preamble) that tells the agency owner ' +
    'what to prioritize right now and why it matters for care delivery, compliance, ' +
    'and getting paid. Lead with the most urgent item. Be direct and specific about ' +
    'the numbers. Do NOT invent details, names, or numbers beyond what is given. If ' +
    'everything is clear, say so briefly and reassuringly.';

  const lines: string[] = [
    `Visits scheduled today: ${s.today.scheduledToday} (completed ${s.today.completed}, in progress ${s.today.inProgress}, late to start ${s.today.lateStart}, upcoming ${s.today.upcoming}).`,
    `Open EVV exceptions: ${s.exceptions.openExceptions}.`,
    `Authorizations: ${s.authorizations.recentlyExpired} expired, ${s.authorizations.expiringIn14d} expiring within 14 days.`,
    `Credentials: ${s.credentials.recentlyExpired} expired, ${s.credentials.expiringIn30d} expiring within 30 days.`,
    `Training: ${Math.round(s.training.complianceRate * 100)}% compliant, ${s.training.overdue} overdue.`,
    `Billing: ${s.claims.verifiedVisitsLast7d} billing-ready this week, ${s.claims.flaggedVisitsLast7d} flagged.`,
    `Payroll: ${s.payroll.inProgressVisits} visits still open (clocked in, not out).`,
    `Coverage: ${s.coverage.totalGaps} upcoming recurring visits not yet generated.`,
  ];

  const priorityList =
    attention.length > 0
      ? attention.map((a) => `- [${a.severity}] ${a.title}`).join('\n')
      : '- Nothing currently flagged.';

  const prompt =
    `Today's numbers:\n${lines.join('\n')}\n\n` +
    `Prioritized flags (most urgent first):\n${priorityList}\n\n` +
    'Write the briefing now.';

  return { system, prompt };
}
