import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * /launch, rebuilt on the shared SiteLayout (teal/orange brand). The
 * "RayHealthEVV™ is live" launch / what's-new narrative. Live capabilities
 * use teal check tiles; roadmap items carry an orange "Roadmap" pill so we
 * tell agencies straight what runs in production today vs. what's committed.
 */

const MK_CLOCK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </>
);

const liveItems: readonly string[] = [
  'Scheduling operations for recurring visits and service coverage',
  'Care plans and PA-coded tasks that the caregiver will actually read',
  'EVV with GPS-verified clock events and exception review before billing',
  '21st Cures Act-ready data capture (all six federal elements)',
  'Mobile field app with 30-second haptic clock-in and offline retry',
  'Audit-grade trail with append-only event log and column-level encryption',
] as const;

const roadmapItems: readonly string[] = [
  'Billing readiness, claim-blocker detection before submission',
  'Payroll readiness, pay-period approvals, exports, authorized provider handoff',
  'Quality assurance, audits, corrective actions, documentation review',
  'RayHealthEVV™ Academy, caregiver lessons, quizzes, certificate renewals',
  'Family portal, calm, real-time visibility, no alarm-bell alerts',
] as const;

export function LaunchPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Launch</span>
          <h1 className="mk-h1">RayHealthEVV™ is live, care, finally on the same page.</h1>
          <p className="mk-lead">
            Today we're launching <strong>RayHealthEVV™</strong>, an operations-grade home care
            platform that brings scheduling, EVV, billing readiness, payroll, caregiver training,
            and family visibility into one calm workspace.
          </p>
          <div className="mk-herocta">
            <Link to="/contact" className="mk-btn mk-pri">Book an agency demo</Link>
            <Link to="/pricing" className="mk-btn mk-ghost">See pricing</Link>
          </div>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-prose">
            <p className="lead">
              Home care agencies are juggling more than they should. Schedules in one tab. EVV in
              another. Billing in a spreadsheet. Payroll in a folder of email exports. Caregivers
              stuck doing real care while paperwork piles up between visits.
            </p>
            <p>
              We didn't want to bolt one more dashboard onto that pile. We wanted a platform that
              takes the operations of running a home care agency seriously, without taking the
              humanity out of it.
            </p>
          </div>
        </div>
      </section>

      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">Shipping today</p>
          <h2 className="mk-h2">What's live today</h2>
          <div className="mk-grid cols2" style={{ marginTop: 32 }}>
            {liveItems.map((line) => (
              <div
                className="mk-card"
                key={line}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', padding: 20 }}
              >
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span style={{ color: 'var(--ink-soft)', fontSize: '0.95rem', lineHeight: 1.55 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">Next two release cycles</p>
          <h2 className="mk-h2">What's on the immediate roadmap</h2>
          <p className="mk-deck">
            We're shipping the launch narrative whole, but only the items above run in production
            today. Everything below is committed against the next two release cycles. We'd rather
            tell you straight than over-claim:
          </p>
          <div className="mk-grid cols2" style={{ marginTop: 32 }}>
            {roadmapItems.map((line) => (
              <div
                className="mk-card"
                key={line}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', padding: 20 }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--accent2-tint)',
                    color: 'var(--accent2-deep)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {mkic(MK_CLOCK)}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--ink-soft)', fontSize: '0.95rem', lineHeight: 1.55 }}>{line}</span>
                  <span className="mk-pill" style={{ alignSelf: 'flex-start' }}>Roadmap</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <div className="mk-prose">
            <h2>Built audit-ready</h2>
            <p>
              Every visit is GPS-verified. Every clock event is timestamped and append-only. Every
              PHI access lands in a tamper-resistant audit_events row. State-aggregator export work
              (Sandata, HHAeXchange) is in flight against the existing Cures-Act data model.
              RayHealthEVV™ is <strong>21st Cures Act-ready by design</strong>, not as a quarterly
              scramble.
            </p>
            <h2>Built for the people doing the work</h2>
            <p>
              The caregiver app gets out of the way. One tap to clock in. Care plan ready. Tasks
              one-hand simple. Less paperwork. More presence.
            </p>
            <h2>Get started</h2>
            <ul>
              <li>
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span>
                  <strong>Agency owners and operators</strong>, <Link to="/contact" style={{ color: 'var(--accent-deep)', fontWeight: 600 }}>book a demo</Link> and we'll walk you through the live workflow on real data.
                </span>
              </li>
              <li>
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span><strong>Caregivers</strong>, your agency can invite you in once they're set up.</span>
              </li>
              <li>
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span>
                  <strong>Families</strong>, a portal experience is on the immediate roadmap; submit the contact form to be notified when it ships.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Welcome to RayHealthEVV™.</h2>
            <p>Care, finally on the same page.</p>
            <div className="mk-herocta">
              <Link to="/contact" className="mk-btn mk-white">Book an agency demo</Link>
              <Link to="/pricing" className="mk-btn mk-outline">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
