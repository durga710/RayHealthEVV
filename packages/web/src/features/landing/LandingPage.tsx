import React from 'react';
import { Link } from 'react-router-dom';
import { HeroGraphic } from './HeroGraphic.js';
import { SupportChat } from '../support/SupportChat.js';

const stats = [
  { value: '30s', label: 'Haptic clock-in confirm' },
  { value: '<5m', label: 'Geofence accuracy' },
  { value: '6/6', label: 'Federal Cures-Act elements' },
  { value: '100%', label: 'PA DHS aligned' },
];

// "What's at launch" tiles. `comingSoon` items render with a roadmap tag
// to keep the launch narrative whole without overclaiming. Aligned with the
// launch playbook §1d but tagged honestly per brand-voice guardrails.
const keyFeatures = [
  {
    title: 'Scheduling, simplified',
    body: 'Drag visits onto the week. Conflicts and credentials checked as you move.',
    comingSoon: false
  },
  {
    title: 'EVV by default',
    body: 'GPS-verified clock-in, clock-out, and exception review — built in. 30-second haptic confirm, accurate to a few meters.',
    comingSoon: false
  },
  {
    title: 'Care plans & tasks',
    body: 'Goals, instructions, and tasks the caregiver will actually read. PA task catalog included.',
    comingSoon: false
  },
  {
    title: 'Billing readiness',
    body: 'Spot claim blockers before they hit the payer.',
    comingSoon: true
  },
  {
    title: 'Payroll readiness',
    body: 'Approve, lock, and export pay periods for authorized payroll-provider handoff.',
    comingSoon: true
  },
  {
    title: 'RayHealthEVV™ Academy',
    body: 'Lessons, quizzes, and certificate renewals — official, not afterthought.',
    comingSoon: true
  }
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
      {/* Launch banner — non-dismissible at launch week, simple to remove later. */}
      <div
        style={{
          backgroundColor: 'var(--color-primary-dark)',
          color: 'white',
          padding: '0.75rem 1rem',
          textAlign: 'center',
          fontSize: '0.95rem',
          fontWeight: 600
        }}
      >
        🩵 <strong>RayHealthEVV™ is live</strong> — the operations-grade home care platform.{' '}
        <Link to="/launch" style={{ color: 'white', textDecoration: 'underline' }}>
          See what's new →
        </Link>
      </div>

      {/* Header */}
      <header style={{ padding: '1.5rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          RayHealthEVV<span style={{ fontSize: '0.7rem', verticalAlign: 'super', color: 'var(--color-accent)' }}>™</span>
        </div>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="#features" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontWeight: 600 }}>Features</a>
          <Link to="/pricing" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontWeight: 600 }}>Pricing</Link>
          <Link to="/demo" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontWeight: 600 }}>Demo</Link>
          <Link to="/contact" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontWeight: 600 }}>Contact</Link>
          <Link to="/login" style={{ backgroundColor: 'var(--color-primary-light)', color: 'white', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700 }}>Log In</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 2rem 3rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ color: 'var(--color-accent)', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', fontSize: '0.875rem' }}>
            Operations-grade home care platform
          </div>
          <h1 style={{ fontSize: '3.75rem', lineHeight: 1.05, color: 'var(--color-primary-dark)', margin: 0 }}>
            Care, finally on the<br /> <span style={{ color: 'var(--color-primary-light)' }}>same page.</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '720px', lineHeight: 1.6, margin: 0 }}>
            RayHealthEVV™ brings scheduling, EVV, billing readiness, payroll, training, and family visibility into one calm workspace — built for the people doing the work.
          </p>

          <HeroGraphic />

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/contact" style={{ backgroundColor: 'var(--color-accent)', color: 'white', textDecoration: 'none', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.1rem', boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)' }}>
              Book an agency demo
            </Link>
            <a href="#features" style={{ backgroundColor: 'white', color: 'var(--color-primary-dark)', border: '2px solid #c9d8e8', textDecoration: 'none', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.1rem' }}>
              See the product
            </a>
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

      {/* What's at launch */}
      <section id="features" style={{ padding: '6rem 2rem 4rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={sectionEyebrow}>What's at launch</p>
            <h2 style={sectionHeading}>One operations-grade workspace.</h2>
            <p style={sectionLead}>
              Calm, dense, useful. For coordinators, caregivers, and the families they serve. Roadmap items are tagged honestly.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {keyFeatures.map((f) => (
              <div key={f.title} style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                {f.comingSoon && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '1.25rem',
                      right: '1.25rem',
                      backgroundColor: '#eef2f7',
                      color: 'var(--color-primary-dark)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Roadmap
                  </span>
                )}
                <h3 style={{ color: 'var(--color-primary-dark)', margin: 0, fontSize: '1.25rem', lineHeight: 1.2, paddingRight: f.comingSoon ? '5rem' : 0 }}>
                  {f.title}
                </h3>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.55, margin: 0, fontSize: '0.95rem' }}>{f.body}</p>
              </div>
            ))}
          </div>
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

      {/* FAQ */}
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
          <span>&copy; {new Date().getFullYear()} RayHealthEVV™. All rights reserved.</span>
          <span>Pennsylvania-built • HIPAA-aware • 21st Century Cures Act ready by design</span>
        </div>
      </footer>

      {/* Floating support chat — visible site-wide. */}
      <SupportChat />
    </div>
  );
}
