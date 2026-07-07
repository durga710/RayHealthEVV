import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson, postJson } from '../../lib/api-client.js';
import { ErrorRetry, EmptyState } from '../../components/state/index.js';
import { PageShell, PageHeader, SectionCard } from '../../components/layout/index.js';
import { MetricCard } from '../../components/MetricCard.js';
import { AttentionCard } from '../../components/AttentionCard.js';
import { CommandPanel } from '../../components/CommandPanel.js';
import { StatusPill, type StatusTone } from '../../components/StatusPill.js';

interface BriefingResponse {
  available: boolean;
  reason?: string;
  briefing?: string;
  provider?: string;
}

type Severity = 'critical' | 'warning' | 'info';

interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  count: number;
  to: string;
}

interface CommandCenterSummary {
  asOf: string;
  generatedAt: string;
  today: { scheduledToday: number; completed: number; inProgress: number; lateStart: number; upcoming: number };
  exceptions: { openExceptions: number };
  authorizations: { activeAuthorizations: number; expiringIn14d: number; recentlyExpired: number };
  credentials: { activeCredentials: number; expiringIn30d: number; recentlyExpired: number };
  claims: { verifiedVisitsLast7d: number; flaggedVisitsLast7d: number };
  payroll: { verifiedHoursLast7d: number; inProgressVisits: number };
  training: { complianceRate: number; overdue: number; expired: number };
  coverage: { totalGaps: number };
  attention: AttentionItem[];
}

// The six actions an owner or coordinator reaches for most, per the Command
// Center priorities' Quick Action Dock. "Generate audit packet" links to the
// existing Audit Defense screen (no dedicated /admin/audit-packet route
// exists yet); update this `to` if/when that route ships.
const quickActions = [
  { title: 'Schedule a visit', to: '/admin/assignments', cta: 'Open assignments' },
  { title: 'Add a client', to: '/admin/clients', cta: 'Open clients' },
  { title: 'Invite a caregiver', to: '/admin/staff', cta: 'Open staff' },
  { title: 'Review EVV exceptions', to: '/admin/compliance-engine/exceptions', cta: 'Open exceptions' },
  { title: 'Generate audit packet', to: '/admin/compliance-engine/audit-defense', cta: 'Open audit defense' },
  { title: 'Open billing queue', to: '/admin/compliance-engine/claims', cta: 'Open claims' },
];

export function CommandCenterPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const loadBriefing = useCallback(() => {
    setBriefingLoading(true);
    postJson<BriefingResponse>('/api/command-center/briefing', {})
      .then((b) => setBriefing(b))
      .catch(() => setBriefing({ available: false, reason: 'Could not generate a briefing right now.' }))
      .finally(() => setBriefingLoading(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<CommandCenterSummary>('/api/command-center/summary')
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message || 'Failed to load the command center'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh each minute, it's a live ops board
    return () => clearInterval(t);
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.firstName || '';

  // Deterministic, real-data-only "ten-second calm test" summary: severity
  // counts and the top priority come straight from the attention engine's
  // already-sorted list (server-computed, never re-derived client-side).
  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
    for (const item of data?.attention ?? []) counts[item.severity] += 1;
    return counts;
  }, [data]);

  const topAttention = data?.attention[0];
  const agencyStatus: { tone: StatusTone; label: string } =
    severityCounts.critical > 0
      ? { tone: 'danger', label: 'Action needed' }
      : severityCounts.warning > 0
        ? { tone: 'warning', label: 'Monitor' }
        : { tone: 'success', label: 'All clear' };
  const attentionHeadline = topAttention
    ? `Top priority: ${topAttention.title}.`
    : 'Nothing needs your attention right now.';

  const updatedAt = data
    ? new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  const scheduledToday = data?.today.scheduledToday ?? 0;
  const completedToday = data?.today.completed ?? 0;
  const completedPct = scheduledToday > 0 ? Math.round((completedToday / scheduledToday) * 100) : 0;

  const flaggedVisits = data?.claims.flaggedVisitsLast7d ?? 0;
  const claimsClean = flaggedVisits === 0;

  return (
    <PageShell>
      <PageHeader
        title={`${greeting}${name ? `, ${name}` : ''}`}
        subtitle={
          data && (
            <span className="command-hero__subtitle">
              <StatusPill tone={agencyStatus.tone} label={agencyStatus.label} dot />
              <span>{attentionHeadline}</span>
            </span>
          )
        }
        actions={
          <>
            {updatedAt && <span className="page-footnote">Updated {updatedAt}</span>}
            <button type="button" onClick={load} className="btn-ghost btn-sm" disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      {error && <ErrorRetry message={error} onRetry={load} />}

      {loading && !data && <div className="page-loading">Loading your agency…</div>}

      {data && (
        <>
          {/* ── AI briefing (on-demand) ── */}
          <CommandPanel
            eyebrow="AI briefing"
            action={
              !briefing?.available && (
                <button
                  type="button"
                  onClick={loadBriefing}
                  disabled={briefingLoading}
                  className="btn-sm command-panel__cta"
                >
                  {briefingLoading ? 'Thinking…' : 'Summarize my day'}
                </button>
              )
            }
          >
            {briefing?.available && briefing.briefing && (
              <p>
                {briefing.briefing}
                <button
                  type="button"
                  onClick={loadBriefing}
                  disabled={briefingLoading}
                  className="command-panel__link-btn"
                >
                  {briefingLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </p>
            )}
            {briefing && !briefing.available && (
              <p className="command-panel__body--muted">{briefing.reason || 'AI briefing is not available.'}</p>
            )}
            {!briefing && (
              <p className="command-panel__body--muted">Get a plain-English summary of what to prioritize today.</p>
            )}
          </CommandPanel>

          {/* ── Needs attention (priority queue) ── */}
          <SectionCard
            title="Needs attention"
            action={
              data.attention.length > 0 ? (
                <div className="attention-header-actions">
                  {severityCounts.critical > 0 && (
                    <StatusPill tone="danger" label={`${severityCounts.critical} critical`} />
                  )}
                  {severityCounts.warning > 0 && (
                    <StatusPill tone="warning" label={`${severityCounts.warning} warning`} />
                  )}
                  {severityCounts.info > 0 && <StatusPill tone="info" label={`${severityCounts.info} info`} />}
                  {topAttention && (
                    <Link to={topAttention.to} className="btn-ghost btn-sm">
                      Resolve next →
                    </Link>
                  )}
                </div>
              ) : undefined
            }
          >
            {data.attention.length === 0 ? (
              <EmptyState
                title="All clear"
                body="No late visits, open exceptions, or lapsed compliance right now."
                cta={{ label: "View today's board", to: '/admin/today' }}
              />
            ) : (
              <div className="attention-list">
                {data.attention.map((item) => (
                  <AttentionCard
                    key={item.id}
                    severity={item.severity}
                    title={item.title}
                    detail={item.detail}
                    to={item.to}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Today's visit operations ── */}
          <SectionCard
            title="Today's visit operations"
            action={
              <Link to="/admin/today" className="btn-ghost btn-sm">
                Open Today Board →
              </Link>
            }
          >
            <div className="progress-row">
              <div className="progress-track">
                <div className="progress-fill" data-tone="success" style={{ width: `${completedPct}%` }} />
              </div>
              <span className="progress-row__label">
                {scheduledToday > 0
                  ? `${completedToday} of ${scheduledToday} visits completed (${completedPct}%)`
                  : 'No visits scheduled today'}
              </span>
            </div>
            <div className="metric-grid metric-grid--today">
              <MetricCard label="Scheduled" value={data.today.scheduledToday} sub="visits today" tone="primary" />
              <MetricCard label="Completed" value={data.today.completed} sub="clocked out" tone="success" />
              <MetricCard label="In progress" value={data.today.inProgress} sub="clocked in" tone="info" />
              <MetricCard
                label="Late to start"
                value={data.today.lateStart}
                sub="no clock-in"
                tone="warning"
                alert={data.today.lateStart > 0}
              />
              <MetricCard label="Upcoming" value={data.today.upcoming} sub="later today" tone="neutral" />
            </div>
          </SectionCard>

          {/* ── Compliance risk strip ── */}
          <SectionCard title="Compliance risk">
            <div className="metric-grid metric-grid--compliance">
              <MetricCard
                label="Open exceptions"
                value={data.exceptions.openExceptions}
                sub="need resolution"
                tone="warning"
                alert={data.exceptions.openExceptions > 0}
              />
              <MetricCard
                label="Auths expiring (14d)"
                value={data.authorizations.expiringIn14d}
                sub={`${data.authorizations.activeAuthorizations} active`}
                tone="accent"
              />
              <MetricCard
                label="Auths expired"
                value={data.authorizations.recentlyExpired}
                sub="blocks reimbursement"
                tone="danger"
                alert={data.authorizations.recentlyExpired > 0}
              />
              <MetricCard
                label="Credentials expiring (30d)"
                value={data.credentials.expiringIn30d}
                sub={`${data.credentials.recentlyExpired} expired`}
                tone="primary"
                alert={data.credentials.recentlyExpired > 0}
              />
              <MetricCard
                label="Training compliance"
                value={`${Math.round(data.training.complianceRate * 100)}%`}
                sub={`${data.training.overdue} overdue`}
                tone="info"
                alert={data.training.overdue > 0}
              />
              <MetricCard
                label="Coverage gaps (14d)"
                value={data.coverage.totalGaps}
                sub="not yet generated"
                tone="warning"
                alert={data.coverage.totalGaps > 0}
              />
            </div>
          </SectionCard>

          {/* ── Billing readiness ── */}
          <SectionCard
            title="Billing readiness"
            action={
              <Link to="/admin/compliance-engine/claims" className="btn-ghost btn-sm">
                Open claims →
              </Link>
            }
          >
            <div className="billing-readiness-row">
              <StatusPill
                tone={claimsClean ? 'success' : 'warning'}
                label={claimsClean ? 'Clean, ready to bill' : `${flaggedVisits} visit${flaggedVisits === 1 ? '' : 's'} need review`}
                dot
              />
            </div>
            <div className="metric-grid metric-grid--compliance">
              <MetricCard
                label="Verified visits (7d)"
                value={data.claims.verifiedVisitsLast7d}
                sub="billing-ready"
                tone="success"
              />
              <MetricCard
                label="Flagged visits (7d)"
                value={data.claims.flaggedVisitsLast7d}
                sub="need review before billing"
                tone="warning"
                alert={data.claims.flaggedVisitsLast7d > 0}
              />
              <MetricCard
                label="Verified hours (7d)"
                value={data.payroll.verifiedHoursLast7d.toFixed(1)}
                sub={`${data.payroll.inProgressVisits} open visits`}
                tone="primary"
                alert={data.payroll.inProgressVisits > 0}
              />
            </div>
          </SectionCard>

          {/* ── Quick actions ── */}
          <SectionCard title="Quick actions">
            <div className="quick-actions-grid">
              {quickActions.map((q) => (
                <Link key={q.to} to={q.to} className="action-card__link">
                  <div className="action-card">
                    <h3 className="action-card__title">{q.title}</h3>
                    <span className="action-card__cta">{q.cta} →</span>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <p className="page-footnote">
            As of {new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · auto-refreshes every minute
          </p>
        </>
      )}
    </PageShell>
  );
}
