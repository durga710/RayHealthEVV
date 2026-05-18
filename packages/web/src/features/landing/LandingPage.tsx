import React from 'react';
import { Link } from 'react-router-dom';

const stats = [
  { value: '100%', label: 'PA DHS aligned' },
  { value: '6/6', label: 'Federal EVV elements' },
  { value: '<60s', label: 'Caregiver clock-in' },
  { value: '21CC', label: 'Cures Act ready' },
];

const steps = [
  {
    n: '01',
    title: 'Build the care plan',
    body: 'Coordinators import authorizations from Sandata or PROMISe and turn them into reusable visit templates with PA-coded tasks.',
  },
  {
    n: '02',
    title: 'Assign a credentialed caregiver',
    body: 'The eligibility engine blocks any assignment whose caregiver has expired TB screening, background check, training, or license records.',
  },
  {
    n: '03',
    title: 'Verify the visit at the door',
    body: 'Caregivers clock in from the mobile app with GPS — accuracy, identity, time, and service code captured for all six federal EVV elements.',
  },
  {
    n: '04',
    title: 'Approve, file, audit',
    body: 'Coordinators review exceptions and every state-changing event is appended to an immutable audit log keyed by agency, actor, entity.',
  },
];

const roles = [
  {
    title: 'Administrators',
    body: 'Single source of truth for agency, payer, and PROMISe credentials. Drill into any visit, any audit row, any caregiver record.',
    points: ['Agency + branch hierarchy', 'Capability-scoped access', 'Audit trail with payload diffs'],
  },
  {
    title: 'Coordinators',
    body: 'Build templates, fill the schedule, and clear exceptions before they age out of the billing window.',
    points: ['Template-driven scheduling', 'Eligibility checks at assignment', 'Visit Review queue'],
  },
  {
    title: 'Caregivers',
    body: 'A single-screen mobile flow for clock-in, task documentation, and clock-out — with GPS verification and offline retry.',
    points: ['One-tap clock-in/out', 'Per-task PA duty codes', 'Telephony fallback for no-signal homes'],
  },
  {
    title: 'Families',
    body: 'Read-only visibility into the care plan and the visits actually delivered — without exposing PHI from other clients.',
    points: ['Care plan read access', 'Visit history view', 'No back-channel chat'],
  },
];

const compliance = [
  { name: '21st Century Cures Act', detail: 'All six federal EVV data elements captured and validated on every clock-out.' },
  { name: 'PA DHS / PROMISe', detail: 'Built around PA personal-assistance and home-health operating tracks; PA task codes 106–256 are first-class.' },
  { name: 'HIPAA', detail: 'PHI is scoped per agency and capability. Access tokens are JWT, password storage is bcrypt with cost 12.' },
  { name: 'Sandata aggregator ready', detail: 'EVV records map cleanly to the federal element schema for downstream submission.' },
  { name: 'Audit-grade trail', detail: 'Immutable audit_events records the actor, entity, payload, and timestamp for every state change.' },
  { name: 'Operational guardrails', detail: 'Rate-limited login and bootstrap, advisory-locked first-admin creation, CORS scoped to allowlisted origins.' },
];

const operations = [
  {
    title: 'Credential-first staffing',
    body: 'Assignments are designed to fail closed when required background checks, TB screening, training, or role credentials are missing or expired.',
  },
  {
    title: 'Authorization-aware scheduling',
    body: 'Templates and visits stay tied to payer authorization windows and units, reducing over-service, missed billing support, and retroactive cleanup.',
  },
  {
    title: 'Field-ready EVV capture',
    body: 'Caregivers get a small mobile workflow for GPS clock-in/out, task completion, exception notes, and offline-friendly retry behavior.',
  },
  {
    title: 'Audit packets on demand',
    body: 'Every protected write and PHI-sensitive read can be reconstructed from immutable audit events with actor, agency, resource, and outcome context.',
  },
];

const roadmap = [
  {
    phase: 'Now',
    title: 'Pennsylvania operating core',
    status: 'Live in demo',
    detail: 'Admin login, PA task library, clients, authorizations, templates, assignments, EVV review, CSRF-protected sessions, and audit events.',
    proof: ['PA-only task catalog', 'Protected admin sessions', 'Visit exception review'],
  },
  {
    phase: 'Next',
    title: 'Caregiver mobile completion loop',
    status: 'Hardening',
    detail: 'Tighten the clock-in/out experience, offline queue visibility, caregiver assignment list, and exception submission from the field.',
    proof: ['Offline retry visibility', 'Clock-in packet review', 'Exception note capture'],
  },
  {
    phase: 'Then',
    title: 'Aggregator submission readiness',
    status: 'Designing',
    detail: 'Normalize EVV records for Sandata/PROMISe export, rejection handling, visit-maintenance corrections, and submission evidence packets.',
    proof: ['Submission mapping', 'Rejection queue', 'Audit evidence packets'],
  },
  {
    phase: 'Later',
    title: 'State expansion without dilution',
    status: 'Policy gated',
    detail: 'Add state policy profiles only when credentialing, geofence, retention, and aggregator rules are represented explicitly in the domain model.',
    proof: ['State policy profiles', 'Aggregator rules', 'Retention controls'],
  },
];

const resources = [
  {
    title: 'CMS EVV guidance',
    type: 'Federal rulebook',
    body: 'Baseline EVV mandate, timelines, and Medicaid expectations for personal care and home health services.',
    href: 'https://www.medicaid.gov/medicaid/home-community-based-services/home-community-based-services-guidance-additional-resources/electronic-visit-verification',
  },
  {
    title: 'Pennsylvania DHS EVV',
    type: 'State operating model',
    body: 'Pennsylvania EVV model, provider responsibilities, open vendor approach, and DHS aggregator context.',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv',
  },
  {
    title: 'PA EVV FAQ',
    type: 'Provider questions',
    body: 'Practical DHS answers on capture methods, alternate EVV, aggregator expectations, and provider workflow.',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv/faq-evv',
  },
  {
    title: 'Free DHS EVV solution',
    type: 'Training and Sandata',
    body: 'DHS EVV solution resources, Sandata On-Demand training, and provider onboarding references.',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv/free-dhs-evv-solution',
  },
  {
    title: 'HIPAA Security Rule',
    type: 'Privacy and security',
    body: 'HHS overview of administrative, physical, and technical safeguards for electronic PHI.',
    href: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
  },
  {
    title: 'RayHealth rollout roadmap',
    type: 'RayHealth internal',
    body: 'Current feature readiness, messaging guardrails, and the implementation work still required before production claims.',
    href: '#roadmap',
  },
];

const faqs = [
  {
    q: 'Why Pennsylvania-only?',
    a: 'Each state encodes EVV differently. By staying scoped to PA we can ship deeper compliance — operating tracks, PROMISe codes, and credential rules — instead of a lowest-common-denominator product.',
  },
  {
    q: 'How does this differ from a general scheduling tool?',
    a: 'Scheduling is one slice. RayHealth EVV ties scheduling to authorization units, caregiver credentials, GPS-verified visits, and an immutable audit trail — the workflow auditors actually look at.',
  },
  {
    q: 'What if a caregiver loses signal during a visit?',
    a: 'The mobile app queues clock-in/out and switches to telephony fallback. Coordinators see the visit flagged with a `telephony-fallback` exception they can approve.',
  },
  {
    q: 'Can families log in?',
    a: 'Yes — with a read-only role scoped to a single client. They cannot see other clients, schedules, or staff records.',
  },
];

const sectionEyebrow: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: 'var(--color-accent)',
  margin: 0,
};

const sectionHeading: React.CSSProperties = {
  fontSize: '2.25rem',
  lineHeight: 1.15,
  color: 'var(--color-primary-dark)',
  margin: '0.75rem auto 1rem',
  maxWidth: '720px',
};

const sectionLead: React.CSSProperties = {
  fontSize: '1.125rem',
  color: 'var(--color-text-muted)',
  lineHeight: 1.6,
  maxWidth: '720px',
  margin: '0 auto',
};

const cardBase: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)',
  textAlign: 'left',
};

export function LandingPage() {
  return (
    <div className="landing-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header className="landing-header">
        <div className="landing-brand">
          RayHealth <span>EVV</span>
        </div>
        <nav className="landing-nav">
          <a href="#how">How it works</a>
          <a href="#roles">Roles</a>
          <a href="#compliance">Compliance</a>
          <a href="#resources">Resources</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#faq">FAQ</a>
          <Link to="/login" className="landing-login-link">Log In</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            Pennsylvania Home Care Platform
          </div>
          <h1>
            EVV operations that prove the visit happened.
          </h1>
          <p>
            RayHealth EVV turns scheduling, authorization units, caregiver credentials, GPS capture, and visit exceptions into one audit-ready workflow for Pennsylvania agencies.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="primary-cta">
              Access Admin Portal
            </Link>
            <a href="#resources" className="secondary-cta">
              Browse resources
            </a>
          </div>
          <div className="hero-proof-strip" aria-label="Implementation status">
            <span>CSRF web sessions</span>
            <span>PA task library</span>
            <span>EVV exception queue</span>
          </div>
        </div>

        <div className="hero-product-preview" aria-label="Live visit command center">
          <div className="preview-topbar">
            <div>
              <p>Live visit command center</p>
              <strong>Wednesday field operations</strong>
            </div>
            <span>PA DHS mode</span>
          </div>
          <div className="preview-grid">
            <div className="preview-card preview-card-strong">
              <span className="preview-label">Visit exceptions</span>
              <strong>7 need coordinator review</strong>
              <p>2 GPS drift, 3 late clock-outs, 2 missing task attestations</p>
            </div>
            <div className="preview-card">
              <span className="preview-label">Credential gate</span>
              <strong>Blocked assignment</strong>
              <p>TB screening expires before scheduled visit window.</p>
            </div>
            <div className="preview-card">
              <span className="preview-label">Authorization burn</span>
              <strong>68% units used</strong>
              <div className="burn-meter" aria-hidden="true"><span /></div>
            </div>
          </div>
          <div className="mobile-visit-card">
            <div>
              <span>Caregiver mobile</span>
              <strong>Clock-in packet ready</strong>
              <p>Client, service code, GPS accuracy, task checklist, and offline retry state.</p>
            </div>
            <div className="mobile-status">Ready</div>
          </div>
          <div className="audit-ribbon">
            <span>Audit event:</span>
            <code>visit.exception.created</code>
            <span>actor, agency, entity, payload</span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section style={{ padding: '0 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', backgroundColor: '#c9d8e8', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ backgroundColor: 'white', padding: '2rem 1rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-primary-dark)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: '6rem 2rem 4rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionEyebrow}>How it works</p>
            <h2 style={sectionHeading}>From authorization to audit-ready visit in four steps.</h2>
            <p style={sectionLead}>
              Every step pushes data into the next, so coordinators stop reconciling spreadsheets and start clearing exceptions.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {steps.map((step) => (
              <div key={step.n} style={{ ...cardBase, position: 'relative', paddingTop: '2.5rem' }}>
                <div style={{ position: 'absolute', top: '-18px', left: '24px', backgroundColor: 'var(--color-accent)', color: 'white', borderRadius: '999px', padding: '0.4rem 0.9rem', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.875rem', letterSpacing: '1px' }}>
                  STEP {step.n}
                </div>
                <h3 style={{ color: 'var(--color-primary)', marginTop: 0, marginBottom: '0.75rem', fontSize: '1.25rem' }}>{step.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.55, margin: 0, fontSize: '0.95rem' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" style={{ padding: '4rem 2rem', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionEyebrow}>Who it's for</p>
            <h2 style={sectionHeading}>One platform, four very different jobs to do.</h2>
            <p style={sectionLead}>Capabilities are scoped per role, so each user only sees what their work actually requires.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {roles.map((role) => (
              <div key={role.title} style={{ ...cardBase, backgroundColor: 'var(--color-bg)', boxShadow: 'none', border: '1px solid #c9d8e8' }}>
                <h3 style={{ color: 'var(--color-primary-dark)', marginTop: 0, marginBottom: '0.75rem', fontSize: '1.35rem' }}>{role.title}</h3>
                <p style={{ color: 'var(--color-text)', lineHeight: 1.55, fontSize: '0.95rem', margin: '0 0 1rem' }}>{role.body}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {role.points.map((p) => (
                    <li key={p} style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--color-accent)', fontWeight: 800 }}>›</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section id="compliance" style={{ padding: '6rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionEyebrow}>Compliance</p>
            <h2 style={sectionHeading}>Built for the framework auditors actually use.</h2>
            <p style={sectionLead}>Compliance isn't a feature toggle — it's the schema, the validation layer, and the audit trail.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {compliance.map((c) => (
              <div key={c.name} style={{ ...cardBase, padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                <div style={{ width: '8px', flexShrink: 0, backgroundColor: 'var(--color-accent)', borderRadius: '4px' }} />
                <div>
                  <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '1.05rem' }}>{c.name}</h3>
                  <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0.5rem 0 0', fontSize: '0.9rem' }}>{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="resources" className="resources-section">
        <div className="resources-inner">
          <div className="resources-heading">
            <p style={sectionEyebrow}>Resource Library</p>
            <h2 style={sectionHeading}>Give agencies the receipts, not just the pitch.</h2>
            <p style={sectionLead}>
              These are the source materials and internal readiness notes we use to keep the product honest while we harden the workflows.
            </p>
          </div>
          <div className="resource-grid">
            {resources.map((resource) => (
              <a key={resource.title} className="resource-card" href={resource.href} target={resource.href.startsWith('http') ? '_blank' : undefined} rel={resource.href.startsWith('http') ? 'noreferrer' : undefined}>
                <span>{resource.type}</span>
                <strong>{resource.title}</strong>
                <p>{resource.body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Operations */}
      <section id="operations" style={{ padding: '4rem 2rem', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionEyebrow}>Operational proof</p>
            <h2 style={sectionHeading}>Built around the messy handoffs agencies fight every week.</h2>
            <p style={sectionLead}>
              RayHealth EVV connects compliance checkpoints to the actual work: hiring, scheduling, field documentation, billing support, and audit response.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {operations.map((item) => (
              <div key={item.title} style={{ ...cardBase, backgroundColor: 'var(--color-bg)', boxShadow: 'none', border: '1px solid #c9d8e8' }}>
                <h3 style={{ color: 'var(--color-primary-dark)', marginTop: 0, marginBottom: '0.75rem', fontSize: '1.2rem' }}>{item.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.55, margin: 0, fontSize: '0.95rem' }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="roadmap-section">
        <div className="roadmap-shell">
          <div className="roadmap-intro-card">
            <p style={{ ...sectionEyebrow, color: '#fb923c' }}>Implementation Roadmap</p>
            <h2>Roadmap cockpit for launch risk.</h2>
            <p>
              The sequence is simple: keep the Pennsylvania demo dependable, close the caregiver mobile loop, then harden aggregator submission with evidence packets agencies can actually hand to an auditor.
            </p>
            <div className="roadmap-signal-grid">
              <span>Updated landing UI</span>
              <span>Resource library added</span>
              <span>Production deployed</span>
            </div>
          </div>

          <div className="roadmap-stage-grid">
            {roadmap.map((item) => (
              <article key={item.phase} className="roadmap-card">
                <div className="roadmap-card-topline">
                  <span>{item.phase}</span>
                  <strong>{item.status}</strong>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <ul>
                  {item.proof.map((proof) => (
                    <li key={proof}>{proof}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="roadmap-resource-callout">
            <div>
              <span>Launch resources</span>
              <strong>Use the resource library to validate every roadmap claim.</strong>
              <p>CMS EVV, Pennsylvania DHS EVV, PA FAQ, Sandata training, and HIPAA Security Rule references are now linked directly on the page.</p>
            </div>
            <a href="#resources">Jump to resources</a>
          </div>
        </div>
      </section>

      <section id="faq" style={{ padding: '4rem 2rem', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionEyebrow}>FAQ</p>
            <h2 style={sectionHeading}>Common questions.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {faqs.map((f) => (
              <details key={f.q} style={{ backgroundColor: 'var(--color-bg)', borderRadius: '12px', padding: '1.25rem 1.5rem', cursor: 'pointer' }}>
                <summary style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-primary-dark)', fontSize: '1.05rem', listStyle: 'none' }}>{f.q}</summary>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.55, margin: '0.75rem 0 0', fontSize: '0.95rem' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '5rem 2rem', backgroundColor: 'var(--color-primary-dark)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
          <h2 style={{ color: 'white', fontSize: '2.25rem', margin: 0, lineHeight: 1.15 }}>Ready to retire the spreadsheets?</h2>
          <p style={{ color: '#bdd3f0', fontSize: '1.125rem', lineHeight: 1.6, maxWidth: '640px', margin: 0 }}>
            Get a live walkthrough of the admin portal and the caregiver mobile flow. We'll bring sample data — bring your hardest workflow.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            <Link to="/login" style={{ backgroundColor: 'var(--color-accent)', color: 'white', textDecoration: 'none', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.05rem', boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)' }}>
              Access Admin Portal
            </Link>
            <a href="mailto:hello@rayhealthevv.com" style={{ backgroundColor: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.3)', textDecoration: 'none', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.05rem' }}>
              Request a demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2.5rem 2rem', backgroundColor: 'var(--color-primary-dark)', color: '#9bb0c8', fontSize: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <span>&copy; {new Date().getFullYear()} RayHealth EVV. All rights reserved.</span>
          <span>Pennsylvania-only • HIPAA-aware • 21st Century Cures Act aligned</span>
        </div>
      </footer>
    </div>
  );
}
