import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingShell } from '../marketing/MarketingShell.js';

/**
 * Public-facing HIPAA compliance page at `/compliance/hipaa`.
 *
 * Audience: prospective customers, agency compliance officers, BAA
 * counterparties, third-party auditors performing diligence.
 *
 * Language guardrails:
 *  - We never use "HIPAA certified" — HHS does not issue HIPAA
 *    certifications, and the term carries legal exposure.
 *  - We use "HIPAA-compliant", "HIPAA-aligned", "Engineered to HIPAA
 *    Security and Privacy Rule controls", and "Documented HIPAA Security
 *    Rule controls" instead.
 *  - Where a third-party assurance would normally be cited, we publish
 *    "Third-party attestation: <pending>" until an actual auditor
 *    completes work; we do not invent cert names.
 *
 * The authoritative engineering record lives in
 * docs/compliance/hipaa/ in the source repository. This page is the
 * customer-facing summary — when policies in that folder change, this
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
  rows: ControlRow[];
}

const safeguards: SafeguardGroup[] = [
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
    cfr: '45 CFR § 164.502 – § 164.528',
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
];

const subprocessors = [
  {
    name: 'Vercel',
    role: 'Web hosting and edge network',
    region: 'US (multi-region edge)',
    dataClass: 'Encrypted ePHI in transit; no plaintext at rest in edge caches'
  },
  {
    name: 'Postgres provider (Neon or equivalent)',
    role: 'Primary database — application state, audit log, ePHI',
    region: 'US (customer-selectable)',
    dataClass:
      'ePHI at rest, encrypted by the provider; application-layer AES-256-GCM for sensitive identifiers'
  },
  {
    name: 'Expo',
    role: 'Mobile build infrastructure for the caregiver app',
    region: 'US',
    dataClass: 'Build artifacts only; no production ePHI is processed by Expo'
  }
];

const sectionWrap: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5rem'
};

const lead: React.CSSProperties = {
  fontSize: '1.0625rem',
  color: 'var(--color-text-muted)',
  lineHeight: 1.65,
  margin: 0
};

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '14px',
  padding: '1.75rem 2rem',
  border: '1px solid #e3eaf2',
  boxShadow: '0 4px 14px rgba(26, 95, 168, 0.06)'
};

const sectionHeading: React.CSSProperties = {
  fontSize: '1.5rem',
  color: 'var(--color-primary-dark)',
  margin: '0 0 0.25rem'
};

const cfrSubhead: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-accent)',
  margin: '0 0 0.75rem'
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  marginTop: '0.5rem'
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 0.9rem',
  backgroundColor: '#f1f5f9',
  color: '#0d1f3c',
  fontWeight: 700,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '2px solid #cbd5e1'
};

const td: React.CSSProperties = {
  padding: '0.75rem 0.9rem',
  borderBottom: '1px solid #e2e8f0',
  verticalAlign: 'top',
  color: 'var(--color-text)'
};

const trustPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  backgroundColor: 'rgba(34, 197, 94, 0.12)',
  color: '#15803d',
  border: '1px solid rgba(34, 197, 94, 0.3)',
  padding: '0.3rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.78rem',
  fontWeight: 700
};

const pendingPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  backgroundColor: '#fef3c7',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '0.3rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.78rem',
  fontWeight: 700
};

function GreenDot(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#16a34a'
      }}
    />
  );
}

export function HipaaCompliancePage(): React.ReactElement {
  return (
    <MarketingShell eyebrow="Compliance" title="HIPAA-compliant by design.">
      <div style={sectionWrap}>
        {/* Lead */}
        <p style={lead}>
          RayHealth EVV is engineered to meet the HIPAA Security Rule
          (45 CFR § 164.308 – § 164.318) and the Privacy Rule controls
          that apply to a Business Associate handling ePHI for
          Pennsylvania home-care agencies.
        </p>

        {/* Trust band */}
        <div
          aria-label="Compliance trust band"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
        >
          {[
            'Encryption at rest',
            'Audit trail',
            'RBAC',
            'Session hardening',
            'Breach process documented'
          ].map((label) => (
            <span key={label} style={trustPill}>
              <GreenDot />
              <span>{label}</span>
            </span>
          ))}
        </div>

        {/* Scope statement */}
        <section aria-labelledby="scope-heading" style={card}>
          <h2 id="scope-heading" style={sectionHeading}>Scope statement</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginTop: '1rem'
            }}
          >
            <div>
              <h3 style={{ fontSize: '0.95rem', color: '#15803d', margin: '0 0 0.5rem' }}>
                What's in scope
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text)', lineHeight: 1.55 }}>
                <li>RayHealth EVV web admin application</li>
                <li>RayHealth EVV caregiver mobile application</li>
                <li>Public RayHealth EVV API and admin API</li>
                <li>Audit pipeline and `audit_events` data of record</li>
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', color: '#b45309', margin: '0 0 0.5rem' }}>
                What's out of scope
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-text)', lineHeight: 1.55 }}>
                <li>Customer-managed Postgres deployments, where applicable</li>
                <li>Customer-side workforce training and policy enforcement</li>
                <li>Downstream BAAs the customer holds with their own partners</li>
                <li>Caregiver mobile devices not enrolled in customer MDM</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Controls table — the meat of the page */}
        <section aria-labelledby="controls-heading">
          <h2 id="controls-heading" style={{ ...sectionHeading, marginBottom: '0.75rem' }}>
            HIPAA Security and Privacy Rule controls
          </h2>
          <p style={{ ...lead, marginBottom: '1.5rem' }}>
            Each row maps a HIPAA safeguard to the concrete control that
            implements it inside RayHealth EVV. CFR section is cited under
            each safeguard heading.
          </p>

          {safeguards.map((group) => (
            <div key={group.safeguard} style={{ ...card, marginBottom: '1.5rem' }}>
              <h3 style={{ ...sectionHeading, fontSize: '1.2rem', margin: 0 }}>
                {group.safeguard}
              </h3>
              <p style={cfrSubhead}>{group.cfr}</p>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th scope="col" style={{ ...th, width: '32%' }}>Control</th>
                    <th scope="col" style={th}>How RayHealth implements it</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.control}>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--color-primary-dark)' }}>
                        {row.control}
                      </td>
                      <td style={td}>{row.implementation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        {/* BAA */}
        <section aria-labelledby="baa-heading" style={card}>
          <h2 id="baa-heading" style={sectionHeading}>Business Associate Agreement</h2>
          <p style={{ color: 'var(--color-text)', lineHeight: 1.65, margin: '0.75rem 0 1rem' }}>
            RayHealth EVV signs a BAA with every customer agency before
            any production ePHI is processed. The current template covers
            the required HIPAA § 164.504(e) provisions: permitted uses,
            safeguards, subcontractor flow-down, breach notification
            within 60 days, and return or destruction of PHI on
            termination.
          </p>
          <a
            href="mailto:compliance@rayhealthevv.com?subject=BAA%20request"
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--color-primary-light)',
              color: 'white',
              textDecoration: 'none',
              padding: '0.65rem 1.2rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.95rem'
            }}
          >
            Request our BAA template
          </a>
        </section>

        {/* Breach notification */}
        <section aria-labelledby="breach-heading" style={card}>
          <h2 id="breach-heading" style={sectionHeading}>Breach notification</h2>
          <p style={{ color: 'var(--color-text)', lineHeight: 1.65, margin: '0.75rem 0 0.75rem' }}>
            If we discover a breach affecting your agency, we notify
            within 60 days per § 164.410, with: incident summary,
            affected records, timeline, remediation steps, and your
            obligations as the covered entity.
          </p>
          <p style={{ color: 'var(--color-text)', lineHeight: 1.65, margin: 0 }}>
            Customers can audit any incident by querying{' '}
            <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.88rem' }}>
              audit_events
            </code>{' '}
            filtered by{' '}
            <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.88rem' }}>
              outcome=failure
            </code>{' '}
            or{' '}
            <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.88rem' }}>
              event_type=permission.denied
            </code>
            .
          </p>
        </section>

        {/* Subprocessors */}
        <section aria-labelledby="subproc-heading" style={card}>
          <h2 id="subproc-heading" style={sectionHeading}>Subprocessors</h2>
          <p style={{ ...lead, fontSize: '0.95rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            We disclose every subprocessor that handles ePHI or hosts
            customer data. Customers may request the current
            authoritative list at any time.
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th scope="col" style={th}>Name</th>
                <th scope="col" style={th}>Role</th>
                <th scope="col" style={th}>Region</th>
                <th scope="col" style={th}>Data class</th>
              </tr>
            </thead>
            <tbody>
              {subprocessors.map((s) => (
                <tr key={s.name}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--color-primary-dark)' }}>{s.name}</td>
                  <td style={td}>{s.role}</td>
                  <td style={td}>{s.region}</td>
                  <td style={td}>{s.dataClass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Third-party attestation */}
        <section aria-labelledby="attest-heading" style={card}>
          <h2 id="attest-heading" style={sectionHeading}>Third-party attestation</h2>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={pendingPill}>Pending</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Third-party attestation: &lt;pending&gt;
            </span>
          </div>
          <p style={{ color: 'var(--color-text)', lineHeight: 1.65, margin: '0.75rem 0 0' }}>
            We are actively pursuing a third-party HIPAA attestation.
            Until it is completed, we publish our control implementation
            here for customer due diligence. We do not claim
            certifications we have not earned.
          </p>
        </section>

        {/* Downloadable artifacts */}
        <section aria-labelledby="artifacts-heading" style={card}>
          <h2 id="artifacts-heading" style={sectionHeading}>Compliance artifacts</h2>
          <p style={{ ...lead, fontSize: '0.95rem', marginTop: '0.5rem' }}>
            Diligence packages are released by request. Email us with
            your agency name and the auditor's contact and we will
            respond within two business days.
          </p>
          <ul style={{ marginTop: '1rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
            <li>
              <a
                href="mailto:compliance@rayhealthevv.com?subject=Security%20%26%20Compliance%20Pack%20request"
                style={{ color: 'var(--color-primary)', fontWeight: 600 }}
              >
                Security &amp; Compliance Pack (PDF)
              </a>{' '}
              — control narratives, encryption verification matrix, and
              incident-response plan.
            </li>
            <li>
              <a
                href="mailto:compliance@rayhealthevv.com?subject=Audit%20log%20sample%20export%20request"
                style={{ color: 'var(--color-primary)', fontWeight: 600 }}
              >
                Audit log sample export (CSV)
              </a>{' '}
              — synthetic, PHI-free sample of the `audit_events` schema.
            </li>
          </ul>
        </section>

        {/* Related */}
        <section aria-labelledby="related-heading" style={{ ...card, backgroundColor: '#f8fafc' }}>
          <h2 id="related-heading" style={sectionHeading}>Related</h2>
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
            <li>
              <Link to="/privacy" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Privacy summary
              </Link>{' '}
              — what we collect, how we use it, and your rights.
            </li>
            <li>
              <Link to="/status" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Service status
              </Link>{' '}
              — live operational health.
            </li>
            <li>
              <Link to="/contact" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Contact compliance
              </Link>{' '}
              — for BAA, diligence, or incident questions.
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
            color: 'var(--color-text-muted)',
            fontSize: '0.85rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e3eaf2'
          }}
        >
          <span>Last updated: {LAST_UPDATED}</span>
          <span>
            Questions:{' '}
            <a
              href="mailto:compliance@rayhealthevv.com"
              style={{ color: 'var(--color-primary)', fontWeight: 600 }}
            >
              compliance@rayhealthevv.com
            </a>
          </span>
        </div>
      </div>
    </MarketingShell>
  );
}
