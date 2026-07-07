import { Link } from 'react-router-dom';
import { SiteLayout } from './SiteLayout.js';

/**
 * Public-facing privacy summary at `/privacy`, migrated onto the shared
 * SiteLayout (teal/orange brand) so it matches the rest of the marketing
 * site. Replaces the old MarketingShell version.
 *
 * Required by Apple App Store / Google Play submission — both stores
 * block listings that don't link to a working privacy policy URL.
 *
 * This page is the customer-facing summary; the authoritative engineering
 * record lives at docs/compliance/hipaa/SECURITY_POLICY.md +
 * docs/compliance/hipaa/ENCRYPTION_VERIFICATION.md +
 * docs/compliance/hipaa/DATA_RETENTION.md. When those change, this page
 * must be updated within 30 days per SECURITY_POLICY.md §1.
 */
export function PrivacyPage() {
  const lastUpdated = '2026-05-09';

  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Privacy</span>
          <h1 className="mk-h1">How we handle your data</h1>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-prose">
            <span className="mk-pill" style={{ marginBottom: '1.5rem' }}>
              Last updated: {lastUpdated}
            </span>

            <p className="lead">
              RayHealthEVV™ is a HIPAA-ready Electronic Visit Verification (EVV)
              and home-care operations platform. It is built to handle Protected
              Health Information (PHI) on behalf of the home-care agencies that
              license us as a Business Associate. Until our operational HIPAA
              readiness milestones (see <Link to="/trust">Trust Center</Link>)
              are complete, no real PHI should be loaded into the
              platform. This page summarizes how that information is collected,
              used, stored, and protected. The full
              engineering record — including subprocessor list, encryption
              verification matrix, and incident-response plan — lives in our
              source repository under <code>docs/compliance/hipaa/</code>.
            </p>

            <h2>What we collect</h2>
            <ul>
              <li>
                <strong>Caregiver and client names + contact info</strong> —
                entered by agency administrators when they set up clients,
                assignments, and staff in their account.
              </li>
              <li>
                <strong>Visit timestamps and GPS verification coordinates</strong>{' '}
                — captured at clock-in and clock-out, required by the 21st Century
                Cures Act (data point #4: location of services). Location is
                never tracked in the background; only at clock-in and clock-out.
              </li>
              <li>
                <strong>Visit notes and care-plan content</strong> — entered by
                caregivers during or after a visit.
              </li>
              <li>
                <strong>Authentication credentials</strong> — email and a
                password (stored as a bcrypt hash, never plaintext) plus a
                session token / bearer JWT.
              </li>
              <li>
                <strong>Encrypted client identifiers</strong> — Medicaid IDs and
                caregiver NPIs are encrypted at the application layer with
                AES-256-GCM before they're written to the database. We can
                verify, in code, that no plaintext copy reaches storage.
              </li>
            </ul>

            <h2>How we use it</h2>
            <p>
              Only to provide the EVV service the agency contracted us for:
              recording visits, surfacing schedules, generating compliance
              exports for state aggregators, and issuing audit trails. We do not
              sell your data, share it with advertisers, or use it to train
              third-party AI models on raw PHI.
            </p>

            <h2>Encryption</h2>
            <div
              style={{
                background: 'var(--ink-bg)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid var(--dark-line)',
                marginTop: '14px',
              }}
            >
              <ul style={{ margin: 0, paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <li style={{ color: '#cfd6d2', lineHeight: 1.6, listStyle: 'none', display: 'block' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      marginRight: '0.5rem',
                      verticalAlign: 'middle',
                    }}
                  />
                  <strong style={{ color: '#fff' }}>In transit:</strong>{' '}
                  TLS 1.2+ everywhere. HSTS is enforced
                  on <code style={{ color: 'var(--accent-tint)', backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>rayhealthevv.com</code> end-to-end through Cloudflare to
                  our compute origin.
                </li>
                <li style={{ color: '#cfd6d2', lineHeight: 1.6, listStyle: 'none', display: 'block' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent2)',
                      marginRight: '0.5rem',
                      verticalAlign: 'middle',
                    }}
                  />
                  <strong style={{ color: '#fff' }}>At rest:</strong>{' '}
                  Database storage is encrypted by our
                  Postgres provider (Neon). Two especially sensitive fields —
                  client Medicaid numbers and caregiver NPIs — get an additional
                  application-layer AES-256-GCM envelope so even a database
                  snapshot exfiltration would expose only ciphertext for those
                  columns.
                </li>
                <li style={{ color: '#cfd6d2', lineHeight: 1.6, listStyle: 'none', display: 'block' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-deep)',
                      marginRight: '0.5rem',
                      verticalAlign: 'middle',
                    }}
                  />
                  <strong style={{ color: '#fff' }}>Mobile credentials:</strong>{' '}
                  Stored in the device
                  platform's secure storage. We treat short-lived bearer JWTs
                  (8-hour expiry) and any device-level keys as the highest
                  sensitivity tier on the device.
                </li>
              </ul>
            </div>

            <h2>Audit trail</h2>
            <p>
              Every PHI access — read, mutation, login, permission decision — is
              recorded in an append-only audit table. The append-only property
              is enforced at the database layer: a Postgres trigger refuses any
              attempt to UPDATE, DELETE, or TRUNCATE the audit log. Even a
              compromised application-level role cannot rewrite history. We
              re-verify the trigger nightly via an automated workflow.
            </p>

            <h2>AI features</h2>
            <p>
              Our marketing-site chat and our in-app coordinator assistant both
              run on AWS Bedrock under an active Business Associate Addendum.
              The marketing chat is anonymous and explicitly refuses PHI; the
              in-app assistant is configured to call only aggregate-count tools
              (e.g. "how many visits this week") and never returns names or
              patient-level data. There is no fallback to a non-BAA AI vendor in
              the codebase — if Bedrock is unavailable, the AI surfaces fail
              closed instead of routing elsewhere.
            </p>

            <h2>Subprocessors</h2>
            <p>
              We use these vendors to deliver the service, each handling PHI only
              as needed for its function. We do not route real patient data
              through a subprocessor until a HIPAA Business Associate Agreement
              (BAA) with that vendor is executed; the current status of each is
              noted below.
            </p>
            <ul>
              <li>
                <strong>Vercel</strong> — application compute (web app + API);
                BAA in progress
              </li>
              <li>
                <strong>Neon</strong> — Postgres database; BAA active, running in
                Neon’s HIPAA mode (pgAudit audit logging, encryption at rest)
              </li>
              <li>
                <strong>AWS</strong> — Bedrock AI inference; BAA active
              </li>
              <li>
                <strong>Cloudflare</strong> — DNS + TLS termination (encrypted
                transit only; not a Business Associate under HHS guidance)
              </li>
              <li>
                <strong>Google Firebase</strong> — push notifications and auth;
                BAA in progress
              </li>
              <li>
                <strong>Resend</strong> — transactional email; BAA in progress
              </li>
            </ul>

            <h2>Retention</h2>
            <ul>
              <li>Audit logs: minimum 6 years (HIPAA §164.530(j))</li>
              <li>Operational PHI records: 7 years (Pennsylvania state floor)</li>
              <li>
                Marketing chat transcripts and contact-form submissions: 6 years
                in case any visitor accidentally types information that should
                be treated as PHI
              </li>
              <li>
                Backups: rotate out automatically after the recovery window
                (typically 7 days for short-term restore points)
              </li>
            </ul>

            <h2>Your rights</h2>
            <p>
              If you are a client or caregiver receiving services through an
              agency that uses RayHealthEVV, your privacy rights flow through
              that agency under its Notice of Privacy Practices. Contact the
              agency directly for access, correction, or deletion requests
              covering your records. We will support the agency in fulfilling
              those requests. To reach us directly about a security or privacy
              concern, use the contact form below or email{' '}
              <a href="mailto:security@rayhealthevv.com">security@rayhealthevv.com</a>.
            </p>

            <h2>Incidents</h2>
            <p>
              If we believe a security incident may have affected your data, we
              will notify the affected agency without unreasonable delay and no
              later than 60 days after discovery, per HIPAA §164.404. The agency
              is responsible for notifying its individual clients per the
              agency's own privacy practices. Some U.S. states require shorter
              windows; we apply whichever rule is stricter.
            </p>

            <h2>Changes</h2>
            <p>
              When the architecture changes materially, we update the underlying
              policy in our source repository within 30 days and refresh this
              page within 30 days of that. Significant changes are noted in the
              review log of <code>docs/compliance/hipaa/SECURITY_POLICY.md</code>.
            </p>

            <h2>Contact</h2>
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid var(--line)',
                marginTop: '14px',
              }}
            >
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Privacy / Security Officer — RayHealthEVV™<br />
                <a href="mailto:security@rayhealthevv.com">security@rayhealthevv.com</a>
                <br />
                Or via <Link to="/contact">/contact</Link> (the form routes to the same
                inbox and is logged).
              </p>
            </div>

            <p style={{ marginTop: '3rem', fontSize: '0.875rem', color: 'var(--mut)' }}>
              This summary is intended to be readable. The authoritative
              engineering and compliance records in our source repository
              supersede any informal summary here. Nothing on this page is
              legal advice.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
