import React from 'react';
import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Public-facing HIPAA compliance page at `/compliance/hipaa`.
 *
 * Migrated from the old MarketingShell to the shared SiteLayout
 * (teal/orange brand). Content is preserved verbatim, only the
 * wrappers and styling were restructured onto the `mk-*` design system.
 *
 * Audience: prospective customers, agency compliance officers, BAA
 * counterparties, third-party auditors performing diligence.
 *
 * Language guardrails:
 *  - We never use "HIPAA certified". HHS does not issue HIPAA
 *    certifications, and the term carries legal exposure.
 *  - We never claim "HIPAA compliant"/"fully compliant" as a finished
 *    state. We use "HIPAA-ready architecture", "Designed with HIPAA-grade
 *    controls", "Engineered to HIPAA Security and Privacy Rule controls",
 *    and "Documented HIPAA Security Rule controls" instead, and describe
 *    operational readiness as in progress.
 *  - Where a third-party assurance would normally be cited, we publish
 *    "Third-party attestation: <pending>" until an actual auditor
 *    completes work; we do not invent cert names.
 *
 * The authoritative engineering record lives in
 * docs/compliance/hipaa/ in the source repository. This page is the
 * customer-facing summary, when policies in that folder change, this
 * page must be updated within 30 days per SECURITY_POLICY.md §1.
 */

const LAST_UPDATED = '2026-05-15';

interface ControlRow {
  control: string;
  implementation: string;
}

interface SafeguardGroup {
  safeguard: string;
  cfr: string;
  rows: readonly ControlRow[];
}

const safeguards: readonly SafeguardGroup[] = [
  {
    safeguard: 'Administrative safeguards',
    cfr: '45 CFR § 164.308',
    rows: [
      {
        control: 'Workforce access management',
        implementation:
          'RBAC scoped per agency and per role (admin, coordinator, caregiver, family). Every protected route enforces a least-privilege capability check before any read or write of ePHI.'
      },
      {
        control: 'Audit controls',
        implementation:
          'A durable `audit_events` table records every state change with actor, event_type, outcome, correlation id, payload, and occurred_at. A Postgres trigger blocks UPDATE and DELETE on this table at the database layer.'
      },
      {
        control: 'Incident response',
        implementation:
          'Breach notification process documented in docs/compliance/hipaa/. The audit trail supports investigation by actor, entity, time window, and outcome.'
      },
      {
        control: 'Workforce training',
        implementation:
          'Customer responsibility under the BAA. We provide policy templates and per-actor access-log exports so the customer can evidence training and least-privilege review.'
      }
    ]
  },
  {
    safeguard: 'Technical safeguards',
    cfr: '45 CFR § 164.312',
    rows: [
      {
        control: 'Access control',
        implementation:
          'Bearer JWT for the caregiver mobile app and HttpOnly cookie sessions for the web admin. JWTs are pinned to HS256, sessions are revocable server-side, and idle sessions time out after 8 hours.'
      },
      {
        control: 'Audit controls',
        implementation:
          'All authenticated requests are logged. CSRF failures, login failures, and session revocations are explicitly recorded as discrete event types so they surface in incident review.'
      },
      {
        control: 'Integrity',
        implementation:
          'TLS 1.2 or higher in transit, Postgres TLS for database connections, bcrypt cost 12 for password storage, and hash-only storage of session and CSRF tokens. Plaintext secrets never reach the database.'
      },
      {
        control: 'Person or entity authentication',
        implementation:
          'Email and password (bcrypt cost 12) with rate-limited login on the web, mobile, and bootstrap endpoints. First-admin bootstrap is gated by an advisory lock so it cannot be replayed.'
      },
      {
        control: 'Transmission security',
        implementation:
          'HTTPS-only via the Vercel edge with HSTS for one year including subdomains and preload. Default CSP is `default-src none` with explicit allowlists; X-Frame-Options is DENY.'
      }
    ]
  },
  {
    safeguard: 'Physical safeguards',
    cfr: '45 CFR § 164.310',
    rows: [
      {
        control: 'Workstation security',
        implementation:
          'Customer responsibility. We recommend agencies enforce MDM and an auto-lock policy on every device that accesses the admin portal.'
      },
      {
        control: 'Device and media disposal',
        implementation:
          'Mobile tokens are stored in expo-secure-store, which is hardware-backed where the device supports it, and are cleared on logout. The server has no long-lived plaintext token store to dispose of.'
      }
    ]
  },
  {
    safeguard: 'Privacy Rule controls',
    cfr: '45 CFR § 164.502, § 164.528',
    rows: [
      {
        control: 'Minimum necessary',
        implementation:
          'Reads are capability-scoped. PHI fields are restricted by role. Export endpoints are scoped to a single agency and never cross-agency.'
      },
      {
        control: 'Right of access',
        implementation:
          "Customer-facing data export is available through the admin API. We respond to a covered entity's right-of-access request within 30 days as required by § 164.524."
      },
      {
        control: 'Right of amendment',
        implementation:
          'Edit workflows are exposed for demographic and care-plan fields. Every amendment is recorded in `audit_events` with actor, before/after payload, and timestamp.'
      },
      {
        control: 'Accounting of disclosures',
        implementation:
          'Every read of PHI fields (`phi.read`, `phi.export`) is logged with actor, entity, timestamp, and purpose-of-use when supplied. Customers can produce an accounting per § 164.528 directly from the audit trail.'
      }
    ]
  }
] as const;

const trustLabels: readonly string[] = [
  'Encryption at rest',
  'Audit trail',
  'RBAC',
  'Session hardening',
  'Breach process documented'
];

const stack: React.CSSProperties = {
  maxWidth: 920,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5rem'
};

const cardHeading: React.CSSProperties = {
  fontSize: '1.5rem',
  color: 'var(--ink)',
  letterSpacing: '-.02em',
  margin: 0
};

const bodyText: React.CSSProperties = {
  color: 'var(--body)',
  lineHeight: 1.65,
  margin: 0
};

const mutedLead: React.CSSProperties = {
  fontSize: '0.95rem',
  color: 'var(--mut)',
  lineHeight: 1.65,
  margin: 0
};

const trustPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: 'var(--accent-tint)',
  color: 'var(--accent-deep)',
  border: '1px solid var(--line-2)',
  padding: '0.3rem 0.75rem',
  borderRadius: 999,
  fontSize: '0.78rem',
  fontWeight: 700
};

const codeChip: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  padding: '0.1rem 0.4rem',
  borderRadius: 4,
  fontSize: '0.88rem',
  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  color: 'var(--accent-deep)'
};

const groupHeading: React.CSSProperties = {
  fontSize: '1.2rem',
  color: 'var(--ink)',
  letterSpacing: '-.01em',
  margin: 0
};

const linkStyle: React.CSSProperties = { color: 'var(--accent-deep)', fontWeight: 600 };

const outScopeItem: React.CSSProperties = {
  color: 'var(--ink-soft)',
  lineHeight: 1.55,
  fontSize: '.97rem'
};

export function HipaaCompliancePage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Compliance</span>
          <h1 className="mk-h1">Designed with HIPAA-grade controls.</h1>
          <p className="mk-lead">
            RayHealthEVV™ is engineered to meet the HIPAA Security Rule
            (45 CFR § 164.308, § 164.318) and the Privacy Rule controls
            that apply to a Business Associate handling ePHI for
            Pennsylvania home-care agencies.
          </p>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div style={stack}>
            {/* Trust band */}
            <div
              aria-label="Compliance trust band"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
            >
              {trustLabels.map((label) => (
                <span key={label} style={trustPill}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)'
                    }}
                  />
                  <span>{label}</span>
                </span>
              ))}
            </div>

            {/* Scope statement */}
            <section aria-labelledby="scope-heading" className="mk-card">
              <h2 id="scope-heading" style={cardHeading}>Scope statement</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginTop: '1rem'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '0.95rem', color: 'var(--accent-deep)', margin: '0 0 0.75rem' }}>
                    What's in scope
                  </h3>
                  <ul className="mk-checks" style={{ margin: 0 }}>
                    <li><span className="mk-ck">{mkic(MK_CHECK)}</span>RayHealthEVV™ web admin application</li>
                    <li><span className="mk-ck">{mkic(MK_CHECK)}</span>RayHealthEVV™ caregiver mobile application</li>
                    <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Public RayHealthEVV™ API and admin API</li>
                    <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Audit pipeline and `audit_events` data of record</li>
                  </ul>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', color: 'var(--accent2-deep)', margin: '0 0 0.75rem' }}>
                    What's out of scope
                  </h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <li style={outScopeItem}>Customer-managed Postgres deployments, where applicable</li>
                    <li style={outScopeItem}>Customer-side workforce training and policy enforcement</li>
                    <li style={outScopeItem}>Downstream BAAs the customer holds with their own partners</li>
                    <li style={outScopeItem}>Caregiver mobile devices not enrolled in customer MDM</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Controls table, the meat of the page */}
            <section aria-labelledby="controls-heading">
              <h2 id="controls-heading" style={cardHeading}>
                HIPAA Security and Privacy Rule controls
              </h2>
              <p className="mk-deck" style={{ marginTop: 12 }}>
                Each row maps a HIPAA safeguard to the concrete control that
                implements it inside RayHealthEVV™. CFR section is cited under
                each safeguard heading.
              </p>

              {safeguards.map((group) => (
                <div key={group.safeguard} style={{ marginTop: 32 }}>
                  <h3 style={groupHeading}>{group.safeguard}</h3>
                  <p className="mk-eylabel" style={{ marginTop: 6 }}>{group.cfr}</p>
                  <table className="mk-tbl" style={{ marginTop: 14 }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: '32%' }}>Control</th>
                        <th scope="col">How RayHealth implements it</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.control}>
                          <td>{row.control}</td>
                          <td>{row.implementation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>

            {/* BAA */}
            <section aria-labelledby="baa-heading" className="mk-card">
              <h2 id="baa-heading" style={cardHeading}>Business Associate Agreement</h2>
              <p style={{ ...bodyText, margin: '0.75rem 0 1rem' }}>
                RayHealthEVV™ executes a BAA with every agency before any PHI
                is processed. The current template covers
                the required HIPAA § 164.504(e) provisions: permitted uses,
                safeguards, subcontractor flow-down, breach notification
                within 60 days, and return or destruction of PHI on
                termination.
              </p>
              <a
                href="mailto:compliance@rayhealthevv.com?subject=BAA%20request"
                className="mk-btn mk-pri"
              >
                Request our BAA template
              </a>
            </section>

            {/* Breach notification */}
            <section aria-labelledby="breach-heading" className="mk-card">
              <h2 id="breach-heading" style={cardHeading}>Breach notification</h2>
              <p style={{ ...bodyText, margin: '0.75rem 0 0.75rem' }}>
                If we discover a breach affecting your agency, we notify
                within 60 days per § 164.410, with: incident summary,
                affected records, timeline, remediation steps, and your
                obligations as the covered entity.
              </p>
              <p style={bodyText}>
                Customers can audit any incident by querying{' '}
                <code style={codeChip}>audit_events</code>{' '}
                filtered by{' '}
                <code style={codeChip}>outcome=failure</code>{' '}
                or{' '}
                <code style={codeChip}>event_type=permission.denied</code>
                .
              </p>
            </section>

            {/* Subprocessors */}
            <section aria-labelledby="subproc-heading" className="mk-card">
              <h2 id="subproc-heading" style={cardHeading}>Subprocessors</h2>
              <p style={{ ...mutedLead, marginTop: '0.5rem', marginBottom: '1rem' }}>
                We disclose every subprocessor that handles ePHI or hosts
                customer data, together with its per-vendor BAA status. To
                avoid two lists drifting out of sync, the canonical, dated
                subprocessor register lives on our{' '}
                <Link to="/privacy" style={linkStyle}>Privacy page</Link>{' '}
                (mirrored on the{' '}
                <Link to="/trust" style={linkStyle}>Trust Center</Link>).
                Customers may request the current authoritative list at any
                time.
              </p>
            </section>

            {/* Third-party attestation */}
            <section aria-labelledby="attest-heading" className="mk-card">
              <h2 id="attest-heading" style={cardHeading}>Third-party attestation</h2>
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className="mk-pill">Pending</span>
                <span style={{ color: 'var(--mut)', fontSize: '0.9rem' }}>
                  Third-party attestation: &lt;pending&gt;
                </span>
              </div>
              <p style={{ ...bodyText, margin: '0.75rem 0 0' }}>
                We are actively pursuing a third-party HIPAA attestation.
                Until it is completed, we publish our control implementation
                here for customer due diligence. We do not claim
                certifications we have not earned.
              </p>
            </section>

            {/* Downloadable artifacts */}
            <section aria-labelledby="artifacts-heading" className="mk-card">
              <h2 id="artifacts-heading" style={cardHeading}>Compliance artifacts</h2>
              <p style={{ ...mutedLead, marginTop: '0.5rem' }}>
                Diligence packages are released by request. Email us with
                your agency name and the auditor's contact and we will
                respond within two business days.
              </p>
              <ul style={{ marginTop: '1rem', paddingLeft: '1.2rem', lineHeight: 1.7, color: 'var(--body)' }}>
                <li>
                  <a
                    href="mailto:compliance@rayhealthevv.com?subject=Security%20%26%20Compliance%20Pack%20request"
                    style={linkStyle}
                  >
                    Security &amp; Compliance Pack (PDF)
                  </a>{' '}
                  (control narratives, encryption verification matrix, and
                  incident-response plan).
                </li>
                <li>
                  <a
                    href="mailto:compliance@rayhealthevv.com?subject=Audit%20log%20sample%20export%20request"
                    style={linkStyle}
                  >
                    Audit log sample export (CSV)
                  </a>{' '}
                  (a synthetic, PHI-free sample of the `audit_events` schema).
                </li>
              </ul>
            </section>

            {/* Related */}
            <section aria-labelledby="related-heading" className="mk-card" style={{ background: 'var(--warm)' }}>
              <h2 id="related-heading" style={cardHeading}>Related</h2>
              <ul style={{ marginTop: '0.75rem', paddingLeft: '1.2rem', lineHeight: 1.7, color: 'var(--body)' }}>
                <li>
                  <Link to="/privacy" style={linkStyle}>
                    Privacy summary
                  </Link>{' '}
                  (what we collect, how we use it, and your rights).
                </li>
                <li>
                  <Link to="/status" style={linkStyle}>
                    Service status
                  </Link>{' '}
                  (live operational health).
                </li>
                <li>
                  <Link to="/contact" style={linkStyle}>
                    Contact compliance
                  </Link>{' '}
                  (for BAA, diligence, or incident questions).
                </li>
              </ul>
            </section>

            {/* Footer band */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                color: 'var(--mut)',
                fontSize: '0.85rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--line)'
              }}
            >
              <span>Last updated: {LAST_UPDATED}</span>
              <span>
                Questions:{' '}
                <a
                  href="mailto:compliance@rayhealthevv.com"
                  style={linkStyle}
                >
                  compliance@rayhealthevv.com
                </a>
              </span>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
