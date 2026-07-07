import { Link } from 'react-router-dom';
import { SiteLayout } from './SiteLayout.js';

/**
 * Public-facing Terms of Service at `/terms`, on the shared SiteLayout so it
 * matches the rest of the marketing site (teal/orange brand). Companion to the
 * `/privacy` summary and `/compliance/hipaa` page.
 *
 * The `version` string below MUST stay in sync with
 * `packages/app/src/terms.ts` (`CURRENT_TERMS_VERSION`). That value is what we
 * record against each principal who accepts these Terms (agency admins at
 * signup, applicants at job application), so the version a user agreed to can
 * always be reconstructed.
 *
 * This is a plain-language operating agreement, not legal advice. The
 * authoritative compliance records live under docs/compliance/.
 */
export function TermsPage() {
  // Keep in sync with CURRENT_TERMS_VERSION in packages/app/src/terms.ts
  const version = '2026-06-28';
  const lastUpdated = '2026-06-28';

  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Legal</span>
          <h1 className="mk-h1">Terms of Service</h1>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-prose">
            <span className="mk-pill" style={{ marginBottom: '1.5rem' }}>
              Version {version} · Last updated: {lastUpdated}
            </span>

            <p className="lead">
              These Terms of Service (the &ldquo;Terms&rdquo;) govern your access
              to and use of RayHealthEVV&trade;, a HIPAA-aware Electronic Visit
              Verification (EVV) and home-care operations platform (the
              &ldquo;Service&rdquo;) operated by RayHealthEVV (&ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By creating an account,
              submitting a job application through an agency that uses the
              Service, or otherwise using the Service, you agree to these Terms.
              If you do not agree, do not use the Service.
            </p>

            <h2>1. Who may use the Service</h2>
            <p>
              The Service is offered to licensed Pennsylvania home-care agencies
              and the administrators, coordinators, caregivers, and applicants
              they invite. You must be at least 18 years old and able to form a
              binding contract. If you accept these Terms on behalf of an agency
              or other organization, you represent that you have authority to
              bind that organization, and &ldquo;you&rdquo; refers to that
              organization.
            </p>

            <h2>2. The Service we provide</h2>
            <p>
              RayHealthEVV provides scheduling, electronic visit verification
              (clock-in/clock-out with GPS verification required by the 21st
              Century Cures Act), compliance exports to state aggregators,
              billing and payroll support, workforce training, and related
              administrative tooling. Features evolve; we may add, change, or
              remove functionality, but we will not materially reduce the core
              EVV capabilities an active paying agency depends on without
              reasonable notice.
            </p>

            <h2>3. Accounts and security</h2>
            <ul>
              <li>
                You are responsible for safeguarding your login credentials and
                for all activity under your account. Use a strong, unique
                password (minimum 12 characters) and enable two-factor
                authentication where offered.
              </li>
              <li>
                Notify us promptly at{' '}
                <a href="mailto:security@rayhealthevv.com">
                  security@rayhealthevv.com
                </a>{' '}
                if you suspect unauthorized access.
              </li>
              <li>
                Agency administrators are responsible for the accounts they
                create and invite, and for promptly deactivating access when a
                staff member leaves.
              </li>
            </ul>

            <h2>4. The agency relationship and PHI</h2>
            <p>
              When an agency licenses the Service, the agency is the
              &ldquo;Covered Entity&rdquo; (or acts on behalf of one) and we act
              as its &ldquo;Business Associate&rdquo; under HIPAA. Our handling
              of Protected Health Information (PHI) is governed by the Business
              Associate Agreement (BAA) with the agency and by our{' '}
              <Link to="/privacy">Privacy Policy</Link>. Caregivers and clients
              receive services through their agency; individual privacy rights
              flow through that agency&rsquo;s Notice of Privacy Practices.
            </p>

            <h2>5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>
                Enter, falsify, or manipulate visit data, GPS coordinates, or
                timestamps. EVV records are compliance documents, and falsifying
                them may constitute Medicaid fraud.
              </li>
              <li>
                Access data belonging to agencies, clients, or caregivers you are
                not authorized to access, or attempt to defeat access controls.
              </li>
              <li>
                Reverse engineer, scrape, overload, or probe the Service, or use
                it to build a competing product.
              </li>
              <li>
                Upload malware, infringe others&rsquo; rights, or use the Service
                for any unlawful purpose.
              </li>
            </ul>

            <h2>6. Applicants and onboarding</h2>
            <p>
              If you apply for a caregiver position through an agency&rsquo;s
              application or AI-assisted interview, you confirm the information
              you provide is truthful and accurate. Your application data is
              shared with the hiring agency, which makes all hiring decisions; we
              process it on the agency&rsquo;s behalf and do not make employment
              decisions.
            </p>

            <h2>7. Fees</h2>
            <p>
              Paid plans are billed to the agency per the pricing agreed at
              signup or in a separate order. Fees are non-refundable except where
              required by law. We may change pricing prospectively with
              reasonable notice; continued use after a change takes effect
              constitutes acceptance of the new pricing.
            </p>

            <h2>8. Intellectual property</h2>
            <p>
              We own the Service, its software, and its brand. You own the data
              you and your agency enter (&ldquo;Customer Data&rdquo;). You grant
              us a limited license to host, process, and display Customer Data
              solely to provide and improve the Service, consistent with the BAA
              and Privacy Policy. We do not sell Customer Data or use raw PHI to
              train third-party AI models.
            </p>

            <h2>9. Third-party services</h2>
            <p>
              The Service relies on subprocessors (for example, our cloud, AI,
              database, email, and notification providers) listed in our{' '}
              <Link to="/privacy">Privacy Policy</Link>. Your use of those
              underlying services through RayHealthEVV is also subject to their
              respective terms.
            </p>

            <h2>10. Disclaimers</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as
              available.&rdquo; While we build for compliance and reliability, we
              do not warrant that the Service will be uninterrupted, error-free,
              or that it will satisfy every regulatory obligation specific to
              your agency. You remain responsible for your own compliance with
              Pennsylvania DHS rules, Medicaid requirements, and applicable law.
            </p>

            <h2>11. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, we will not be liable for
              indirect, incidental, special, consequential, or punitive damages,
              or for lost profits or data, arising from your use of the Service.
              Our total liability for any claim relating to the Service will not
              exceed the amount the agency paid us for the Service in the 12
              months before the event giving rise to the claim.
            </p>

            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify and hold us harmless from claims arising out
              of your misuse of the Service, your violation of these Terms, or
              your violation of any law or third-party right, including
              falsified visit records or unauthorized data access.
            </p>

            <h2>13. Termination</h2>
            <p>
              You may stop using the Service at any time. We may suspend or
              terminate access for material breach of these Terms, non-payment,
              or to comply with law. On termination, we will make Customer Data
              available for export for a reasonable period, then delete or
              de-identify it per our retention schedule and the BAA.
            </p>

            <h2>14. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Commonwealth of
              Pennsylvania, without regard to conflict-of-laws principles. The
              state and federal courts located in Pennsylvania have exclusive
              jurisdiction over disputes that are not otherwise resolved.
            </p>

            <h2>15. Changes to these Terms</h2>
            <p>
              We may update these Terms. When we make material changes, we will
              update the version and date above and, where appropriate, notify
              account administrators. Continued use of the Service after changes
              take effect constitutes acceptance of the updated Terms.
            </p>

            <h2>16. Contact</h2>
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
                RayHealthEVV&trade;
                <br />
                <a href="mailto:legal@rayhealthevv.com">legal@rayhealthevv.com</a>
                <br />
                Or via <Link to="/contact">/contact</Link>.
              </p>
            </div>

            <p style={{ marginTop: '3rem', fontSize: '0.875rem', color: 'var(--mut)' }}>
              This page is written to be readable and is not legal advice. For a
              fully negotiated agreement, agencies should refer to their signed
              order and Business Associate Agreement, which govern in the event
              of any conflict with this summary.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
