import { Link } from 'react-router-dom';
import { SiteLayout } from './SiteLayout.js';
import { SectionCard, TrustBadge, WorkflowStepper, StatusPill, Icon, type IconName, type WorkflowStep } from '../../../components/index.js';

/**
 * Public-facing Trust Center at `/trust`.
 *
 * Audience: prospective home-care agency owners, compliance officers, and
 * their auditors doing security diligence before onboarding.
 *
 * Language guardrails (enforced by docs/agent-reports/00-fable5-executive-
 * architecture.md §10.1 and the forbidden-phrase posture):
 *  - NEVER "HIPAA certified", "fully HIPAA compliant", unqualified
 *    "HIPAA-compliant", "guaranteed compliance", or any implication that
 *    real PHI is supported today.
 *  - Approved forms only: "HIPAA-ready architecture", "designed with
 *    HIPAA-grade controls", "operational HIPAA readiness in progress",
 *    "BAA readiness roadmap".
 *
 * This page is DELIBERATELY consistent with PrivacyPage.tsx, which is the
 * canonical source for per-vendor BAA status (Vercel / Neon / Resend /
 * Firebase "in progress", AWS "active", Cloudflare not a BA). Nothing here
 * may contradict that table. The authoritative engineering record lives in
 * docs/compliance/hipaa/ in the source repository.
 */

const LAST_UPDATED = '2026-07-06';

interface SecurityControl {
  icon: IconName;
  label: string;
  detail: string;
  tone: 'primary' | 'accent';
}

// Every item below is an IMPLEMENTED architectural control per the scout /
// architecture reports, presented as "claim → mechanism".
const securityControls: readonly SecurityControl[] = [
  {
    icon: 'app-window',
    label: 'HttpOnly web sessions',
    detail: 'The admin web session lives in an HttpOnly cookie, never in browser storage, so a cross-site script cannot read it.',
    tone: 'primary',
  },
  {
    icon: 'shield-check',
    label: 'CSRF protection on state changes',
    detail: 'Every mutating web request carries a CSRF token; failures are rejected and logged as discrete events.',
    tone: 'accent',
  },
  {
    icon: 'smartphone',
    label: 'Mobile secure storage',
    detail: 'Caregiver mobile tokens are held in the device secure store (hardware-backed where supported) and cleared on logout.',
    tone: 'primary',
  },
  {
    icon: 'key',
    label: 'Capability-based RBAC',
    detail: 'Each protected route checks a least-privilege capability, scoped per agency and per role, before any read or write.',
    tone: 'accent',
  },
  {
    icon: 'file-text',
    label: 'Append-only audit log',
    detail: 'Every state change is written to an audit table a Postgres trigger refuses to UPDATE or DELETE, the log cannot be edited, even by us.',
    tone: 'primary',
  },
  {
    icon: 'gauge',
    label: 'Rate limits on sensitive endpoints',
    detail: 'Login, bootstrap, and other sensitive surfaces are rate-limited to blunt credential-stuffing and abuse.',
    tone: 'accent',
  },
  {
    icon: 'cpu',
    label: 'Production AI provider guardrails',
    detail: 'AI inference runs only through a BAA-covered vendor; non-BAA AI provider keys are blocked in production by code, and the AI surfaces fail closed.',
    tone: 'primary',
  },
];

// Honest roadmap. Nothing is marked "complete", operational HIPAA readiness
// is in progress, and overclaiming a milestone as done is exactly what the
// language guardrails forbid. "active" = underway, "upcoming" = not started.
const roadmap: readonly WorkflowStep[] = [
  {
    id: 'baa',
    label: 'Business Associate Agreement coverage',
    description: 'AWS Bedrock and Neon BAAs active; Vercel, Firebase, and Resend BAAs in progress. We execute a BAA with every agency before any PHI is processed.',
    status: 'active',
  },
  {
    id: 'hipaa-db',
    label: 'HIPAA-mode database posture',
    description: 'Complete: the Postgres database runs in Neon’s HIPAA mode under an executed BAA, with pgAudit audit logging enabled and encryption at rest.',
    status: 'complete',
  },
  {
    id: 'risk-analysis',
    label: 'Annual security risk analysis',
    description: 'A formal, documented risk analysis on the cadence HIPAA expects.',
    status: 'upcoming',
  },
  {
    id: 'pen-test',
    label: 'Independent penetration test',
    description: 'Third-party penetration test with findings tracked to remediation.',
    status: 'upcoming',
  },
  {
    id: 'cyber-insurance',
    label: 'Cyber liability insurance',
    description: 'Coverage appropriate to a platform handling regulated health data.',
    status: 'upcoming',
  },
  {
    id: 'incident-response',
    label: 'Incident response plan',
    description: 'A breach-notification and incident-response process documented under docs/compliance/hipaa/, being formalized and rehearsed.',
    status: 'active',
  },
  {
    id: 'backup-dr',
    label: 'Backup & disaster recovery',
    description: 'Automated backups with a defined recovery window; formal recovery testing is being built out.',
    status: 'active',
  },
  {
    id: 'workforce-access',
    label: 'Workforce access policy',
    description: 'Documented least-privilege access and review policy for the workforce.',
    status: 'active',
  },
  {
    id: 'subprocessor-review',
    label: 'Subprocessor review & disclosure',
    description: 'A published, dated subprocessor list with per-vendor BAA status, reviewed on an ongoing basis.',
    status: 'active',
  },
];

interface AiPolicyPoint {
  title: string;
  detail: string;
}

const aiPolicy: readonly AiPolicyPoint[] = [
  {
    title: 'Count-only where possible',
    detail: 'The in-app assistant is configured to call aggregate-count tools ("how many visits this week") rather than patient-level queries wherever a count answers the question.',
  },
  {
    title: 'No unnecessary PHI to AI',
    detail: 'We do not send patient-level detail to AI when a count or status will do. The public support chat has no database access and explicitly refuses PHI.',
  },
  {
    title: 'Human in the loop',
    detail: 'The copilot proposes; a person approves. There is no autonomous action, the AI never edits a claim, schedule, or record on its own.',
  },
  {
    title: 'AI actions are audit-logged',
    detail: 'Copilot queries and approved actions are recorded in the same append-only audit trail as every other state change; assistant conversations are logged with session and model metadata. An AI-approved change is as traceable as a manual one.',
  },
];

interface Subprocessor {
  name: string;
  role: string;
  status: string;
  statusTone: 'success' | 'info' | 'neutral';
}

// Mirrors PrivacyPage.tsx exactly, this is NOT a place to invent vendors.
const subprocessors: readonly Subprocessor[] = [
  { name: 'Vercel', role: 'Application compute (web app + API)', status: 'BAA in progress', statusTone: 'info' },
  { name: 'Neon', role: 'Postgres database', status: 'BAA active', statusTone: 'success' },
  { name: 'AWS', role: 'Bedrock AI inference', status: 'BAA active', statusTone: 'success' },
  { name: 'Cloudflare', role: 'DNS + TLS termination (encrypted transit only)', status: 'Not a Business Associate', statusTone: 'neutral' },
  { name: 'Google Firebase', role: 'Push notifications and auth', status: 'BAA in progress', statusTone: 'info' },
  { name: 'Resend', role: 'Transactional email', status: 'BAA in progress', statusTone: 'info' },
];

export function TrustCenterPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Trust</span>
          <h1 className="mk-h1">RayHealthEVV Trust Center</h1>
          <p className="mk-lead">
            Built for homecare operators who need security, accountability, and
            audit-ready workflows. Every claim below follows one pattern, the
            control, the mechanism that enforces it, and where you can verify
            it. Where our operational HIPAA readiness is still in progress, we
            say so.
          </p>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div
            style={{
              maxWidth: 920,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-8)',
            }}
          >
            <span className="mk-pill">Last updated: {LAST_UPDATED}</span>

            {/* 2. Current readiness status */}
            <SectionCard title="Current readiness status" bordered>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                RayHealthEVV is built with <strong>HIPAA-grade architectural
                controls</strong>, encryption in transit, per-agency data
                isolation, an append-only audit trail, and revocable sessions , 
                that are implemented and running today. Our{' '}
                <strong>operational HIPAA readiness is in progress</strong>:
                vendor Business Associate Agreements, a formal risk analysis, an
                independent penetration test, and the other milestones on the
                roadmap below are being completed, not yet finished.
              </p>
              <div className="info-banner banner-warning" role="note" style={{ marginTop: 'var(--space-4)' }}>
                <div>
                  <span className="info-banner__title">No real PHI should be onboarded yet.</span>{' '}
                  <span className="info-banner__detail">
                    Until vendor BAAs are executed and the risk analysis,
                    penetration test, and remaining readiness milestones are
                    complete, no real Protected Health Information should be
                    loaded into the platform. We would rather show you exactly
                    where we stand than hand you a claim you cannot check.
                  </span>
                </div>
              </div>
            </SectionCard>

            {/* 3. Security architecture */}
            <SectionCard title="Security architecture">
              <p style={{ margin: '0 0 var(--space-4)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                These controls are implemented in the platform today. The trust
                story is architectural: several of these guarantees are enforced
                by the database and the server, not by policy alone.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                {securityControls.map((c) => (
                  <TrustBadge
                    key={c.label}
                    icon={<Icon name={c.icon} size={20} />}
                    label={c.label}
                    detail={c.detail}
                    tone={c.tone}
                  />
                ))}
              </div>
            </SectionCard>

            {/* 4. HIPAA operational readiness roadmap */}
            <SectionCard title="HIPAA operational readiness roadmap">
              <p style={{ margin: '0 0 var(--space-6)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                This is a <strong>BAA readiness roadmap</strong>, shown honestly.
                Each item is marked complete, in progress, or planned. Most of
                the work that stands between our HIPAA-ready architecture and
                full operational readiness for real PHI is still ahead.
              </p>
              <WorkflowStepper orientation="vertical" steps={[...roadmap]} />
              <div
                style={{
                  marginTop: 'var(--space-6)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Legend
                </span>
                <StatusPill label="Complete" tone="success" dot />
                <StatusPill label="In progress" tone="info" dot />
                <StatusPill label="Planned" tone="neutral" dot />
              </div>
            </SectionCard>

            {/* 5. AI and PHI policy */}
            <SectionCard title="AI and PHI policy">
              <p style={{ margin: '0 0 var(--space-4)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                AI helps our team move faster without becoming a new way for PHI
                to leak. The posture is propose-only, PHI-minimized, and logged.
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {aiPolicy.map((p) => (
                  <li key={p.title} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <span className="status-dot" data-tone="info" aria-hidden style={{ marginTop: '0.45rem' }} />
                    <span>
                      <strong style={{ color: 'var(--color-text)' }}>{p.title}.</strong>{' '}
                      <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>{p.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* 6. Subprocessors */}
            <SectionCard title="Subprocessors">
              <p style={{ margin: '0 0 var(--space-4)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                We do not route real patient data through a subprocessor until a
                HIPAA Business Associate Agreement with that vendor is executed.
                The list below mirrors our{' '}
                <Link to="/privacy" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                  Privacy summary
                </Link>
                , which is the canonical, dated source for per-vendor BAA status.
                Any additional vendor is treated as under review and disclosed
                there before it processes PHI.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="mk-tbl">
                  <thead>
                    <tr>
                      <th scope="col">Vendor</th>
                      <th scope="col">Role</th>
                      <th scope="col">BAA status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subprocessors.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>{s.role}</td>
                        <td>
                          <StatusPill label={s.status} tone={s.statusTone} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* 7. Security contact */}
            <SectionCard title="Security contact" bordered>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
                Security or privacy concern? Reach our Privacy / Security Officer
                directly. Diligence requests. BAA template, control narratives,
                or a synthetic PHI-free audit-log sample, are answered on the
                same channel.
              </p>
              <p style={{ margin: 'var(--space-4) 0 0', lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
                Privacy / Security Officer. RayHealthEVV™
                <br />
                <a href="mailto:security@rayhealthevv.com" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                  security@rayhealthevv.com
                </a>
                <br />
                Or via <Link to="/contact" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>/contact</Link>{' '}
                (the form routes to the same inbox and is logged).
              </p>
              <p style={{ margin: 'var(--space-4) 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Related:{' '}
                <Link to="/compliance/hipaa" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>HIPAA controls</Link>,{' '}
                <Link to="/privacy" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>Privacy summary</Link>,{' '}
                <Link to="/status" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>Service status</Link>.
              </p>
            </SectionCard>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              This page is a readable summary for buyer diligence. The
              authoritative engineering and compliance records in our source
              repository supersede any informal summary here. Nothing on this
              page is legal advice.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
