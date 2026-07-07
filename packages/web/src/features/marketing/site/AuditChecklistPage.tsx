import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Resources › Checklist: Preparing for a PA DHS audit.
 * A practical, honest checklist of what a Pennsylvania home-care agency should
 * have ready, organized by review area, with a short note on how RayHealth
 * helps satisfy each one.
 */

interface ChecklistSection {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  items: string[];
  rayhealth: string;
}

const sections: ChecklistSection[] = [
  {
    title: 'Documentation & policies',
    blurb: 'The written backbone reviewers ask for first, current, signed, and findable.',
    icon: mkic(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </>,
    ),
    items: [
      'Current policy & procedure manual with review/revision dates',
      'Consumer service agreements and consents on file',
      'Care plans / service plans matching authorized services',
      'Visit notes and task documentation for the review period',
      'Incident and complaint logs with resolution records',
      'Organizational chart and governing-body records',
    ],
    rayhealth:
      'RayHealth keeps care plans, consents, and visit notes versioned and timestamped, so the documentation behind any visit is retrievable in seconds.',
  },
  {
    title: 'EVV records',
    blurb: 'Proof that authorized visits actually happened, captured the way the Cures Act requires.',
    icon: mkic(
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>,
    ),
    items: [
      'All six federal EVV elements captured per visit (who, what, where, when, service, recipient)',
      'GPS / verified location data for clock-in and clock-out',
      'Documented handling of manual edits, exceptions, and corrections',
      'Reconciliation between EVV records and submitted claims',
      'Evidence of aggregator transmission where applicable',
    ],
    rayhealth:
      'Every RayHealth visit records the six federal elements with verified location and a tamper-evident edit trail, and reconciles cleanly against the claim.',
  },
  {
    title: 'Credentials & training',
    blurb: 'Every caregiver who delivered a visit was qualified and current when they did it.',
    icon: mkic(
      <>
        <path d="M22 10 12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
      </>,
    ),
    items: [
      'Background checks and clearances on file with valid dates',
      'TB tests, health records, and CPR/first-aid current',
      'Professional licenses verified and unexpired',
      'Annual training hours and competencies documented (PA §52.18)',
      'Signed job descriptions and agency agreements',
    ],
    rayhealth:
      'The workforce module tracks each credential and training requirement with expirations, and eligibility gating blocks assigning anyone who is not current.',
  },
  {
    title: 'Authorizations & billing',
    blurb: 'What was billed was authorized, delivered, and supported by the record.',
    icon: mkic(
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>,
    ),
    items: [
      'Current service authorizations matching delivered services and units',
      'Claims reconciled to verified visits and authorized task codes',
      'No billing beyond authorized units or date ranges',
      'Documentation supporting every billed unit',
      'Records of denials, adjustments, and resubmissions',
    ],
    rayhealth:
      'RayHealth ties claims to authorizations and verified visits, flagging units that exceed authorization before a claim ever goes out.',
  },
  {
    title: 'Privacy & security',
    blurb: 'PHI is handled, stored, and accessed the way HIPAA requires.',
    icon: mkic(
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>,
    ),
    items: [
      'HIPAA policies, risk assessment, and workforce training records',
      'Role-based access controls and unique user logins',
      'Audit logs of who accessed which records and when',
      'Business associate agreements (BAAs) with vendors',
      'Breach notification and incident-response procedures',
    ],
    rayhealth:
      'RayHealth enforces role-based access and keeps audit logs of PHI access, with HIPAA-aware infrastructure documented for your risk assessment.',
  },
];

export function AuditChecklistPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Resources · Checklist</span>
          <h1 className="mk-h1">Preparing for a PA DHS audit.</h1>
          <p className="mk-lead">
            A practical checklist of what a Pennsylvania home-care agency should have ready before a
            Department of Human Services review &mdash; organized by the areas surveyors actually
            examine, with how RayHealth answers each one.
          </p>
          <div className="mk-herocta">
            <span className="mk-pill">Checklist</span>
          </div>
        </div>
      </header>

      {/* Intro */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-prose">
            <p className="lead">
              Audit readiness is not a scramble before the surveyor arrives &mdash; it&rsquo;s the
              byproduct of running clean operations every day. The most prepared agencies can produce
              any record, for any visit, on request.
            </p>
            <p>
              Use the sections below as a working checklist. Each lists concrete items to have on
              hand, grouped by the review area a PA DHS audit tends to focus on. Treat it as a
              practical starting point, not legal advice &mdash; confirm current requirements against
              DHS guidance and your agency&rsquo;s licensure category.
            </p>
          </div>
        </div>
      </section>

      {/* Checklist sections */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">The checklist</p>
          <h2 className="mk-h2">Five areas to have audit-ready.</h2>
          <p className="mk-deck">
            Work through each section. If you can produce every item without hunting, you&rsquo;re in
            good shape for a DHS review.
          </p>

          <div className="mk-grid cols2" style={{ marginTop: 36 }}>
            {sections.map((s) => (
              <div className="mk-card" key={s.title} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="mk-ficon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.blurb}</p>
                <ul className="mk-checks">
                  {s.items.map((item) => (
                    <li key={item}>
                      <span className="mk-ck">{mkic(MK_CHECK)}</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: '1px solid var(--line)',
                    fontSize: '.9rem',
                    lineHeight: 1.55,
                    color: 'var(--ink-soft)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--accent-deep)' }}>How RayHealth answers this:</span>{' '}
                  {s.rayhealth}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-grid cols2">
            <Link to="/platform/compliance" className="mk-card" style={{ display: 'block' }}>
              <div className="mk-ficon">
                {mkic(
                  <>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </>,
                )}
              </div>
              <h3>Compliance platform</h3>
              <p>How verified visits, defensible claims, and audit logs come together as one compliance core.</p>
              <p className="mk-line" style={{ marginTop: 12 }}>Explore compliance &rarr;</p>
            </Link>
            <Link to="/compliance/hipaa" className="mk-card" style={{ display: 'block' }}>
              <div className="mk-ficon">
                {mkic(
                  <>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </>,
                )}
              </div>
              <h3>HIPAA at RayHealth</h3>
              <p>Our approach to PHI, access controls, and the safeguards behind the privacy &amp; security section above.</p>
              <p className="mk-line" style={{ marginTop: 12 }}>Read the HIPAA overview &rarr;</p>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Walk into your next audit ready.</h2>
            <p>
              See how RayHealth keeps care plans, EVV records, credentials, and claims reconciled and
              retrievable &mdash; so audit prep is a report you run, not a fire drill.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/platform/compliance" className="mk-btn mk-outline">Explore compliance</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
