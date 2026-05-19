import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';

/* ── data ── */

const stats = [
  { value: '30s', label: 'Haptic clock-in' },
  { value: '<5m', label: 'GPS accuracy' },
  { value: '6/6', label: 'Cures Act elements' },
  { value: '100%', label: 'PA DHS aligned' },
];

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Scheduling',
    body: 'Drag visits onto the week. Credential and authorization conflicts are caught as you build.',
    live: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: 'EVV by default',
    body: 'GPS-verified clock-in and clock-out, accurate to a few meters. All six federal EVV elements captured on every visit.',
    live: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    ),
    title: 'Care plans & tasks',
    body: 'PA task codes 106–256 built in. Goals and duty codes the caregiver actually reads before the visit starts.',
    live: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Audit trail',
    body: 'Every state change — login, logout, CSRF failure, PHI read — is appended to an immutable event log with actor, outcome, and payload.',
    live: true,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Billing readiness',
    body: 'Spot claim blockers before they reach the payer — units, dates, EVV status, and documentation gaps surfaced in one queue.',
    live: false,
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      </svg>
    ),
    title: 'EVV Academy',
    body: 'Lessons, quizzes, and certificate renewals for caregivers and coordinators — compliant training, not an afterthought.',
    live: false,
  },
];

const steps = [
  { n: '01', title: 'Import authorizations', body: 'Pull from Sandata or PROMISe and turn them into reusable visit templates with PA-coded tasks.' },
  { n: '02', title: 'Assign a credentialed caregiver', body: 'The eligibility engine blocks any assignment with an expired TB screen, background check, or training record.' },
  { n: '03', title: 'Verify at the door', body: 'Caregivers clock in via GPS — accuracy, identity, time, and service code captured for all six federal EVV elements.' },
  { n: '04', title: 'Approve, file, audit', body: 'Coordinators clear exceptions and every change is appended to an immutable audit log keyed by agency, actor, and entity.' },
];

const roles = [
  { label: 'Admins', points: ['Agency + branch hierarchy', 'Capability-scoped access', 'Full audit trail'] },
  { label: 'Coordinators', points: ['Template-driven scheduling', 'Eligibility at assignment', 'Exception queue'] },
  { label: 'Caregivers', points: ['One-tap GPS clock-in/out', 'PA duty codes per task', 'Telephony fallback'] },
  { label: 'Families', points: ['Care plan read access', 'Visit history view', 'PHI-scoped to one client'] },
];

const compliance = [
  { badge: 'CURES', name: '21st Century Cures Act', body: 'All six federal EVV data elements captured and validated on every clock-out.' },
  { badge: 'PA DHS', name: 'PA DHS / PROMISe', body: 'PA personal-assistance and home-health tracks; task codes 106–256 are first-class.' },
  { badge: 'HIPAA', name: 'HIPAA', body: 'PHI scoped per agency. HttpOnly cookie sessions, bcrypt cost-12, append-only audit log.' },
  { badge: 'EVV', name: 'Sandata aggregator', body: 'EVV records map to the federal element schema for downstream submission.' },
];

const faqs = [
  { q: 'Why Pennsylvania only?', a: 'Depth over breadth. PA-specific operating tracks, PROMISe codes, and credential rules are first-class — not approximated from a generic data model.' },
  { q: 'How does this compare to a scheduling tool?', a: 'Scheduling is one slice. RayHealth EVV ties it to authorization units, credential checks, GPS-verified visits, and an audit trail that satisfies a DHS review.' },
  { q: 'What if a caregiver loses signal?', a: 'The mobile app queues events offline and switches to telephony fallback. Coordinators see a telephony-fallback exception they can review and approve.' },
  { q: 'Can families log in?', a: 'Yes — read-only, scoped to a single client. They cannot see other clients, schedules, or staff records.' },
];

/* ── component ── */

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC', fontFamily: 'var(--font-body)' }}>

      {/* ── Banner ── */}
      <div style={{ backgroundColor: '#312E81', color: 'white', padding: '0.625rem 1.5rem', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.01em' }}>
        Now live for Pennsylvania agencies &mdash;{' '}
        <Link to="/launch" style={{ color: '#C7D2FE', textDecoration: 'underline', textUnderlineOffset: '3px' }}>see what shipped in May 2026 →</Link>
      </div>

      {/* ── Nav ── */}
      <header style={{ backgroundColor: '#0F172A', padding: '0 2.5rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '1.0625rem', letterSpacing: '-0.02em' }}>RayHealth</span>
          <span style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', color: 'white', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '4px' }}>EVV</span>
        </Link>
        <nav style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {[
            { to: '/pricing', label: 'Pricing' },
            { to: '/demo', label: 'Demo' },
            { to: '/contact', label: 'Contact' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{ color: '#94A3B8', textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem', padding: '0.375rem 0.75rem', borderRadius: '6px' }}>
              {label}
            </Link>
          ))}
          <Link to="/login" style={{ marginLeft: '0.5rem', backgroundColor: '#6366F1', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem', padding: '0.5rem 1.125rem', borderRadius: '8px', letterSpacing: '-0.01em' }}>
            Log in
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section style={{ backgroundColor: '#0F172A', color: 'white', padding: '5rem 2.5rem 4rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Ambient glow */}
        <div aria-hidden style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '700px', height: '400px', background: 'radial-gradient(ellipse, rgba(99,102,241,0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          {/* Eyebrow */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '999px', padding: '0.3rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A5B4FC' }}>
            <span aria-hidden style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#818CF8', display: 'inline-block' }} />
            Operations-grade home care — Pennsylvania
          </div>

          <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', lineHeight: 1.06, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: 'white' }}>
            Care, finally on<br />the <span style={{ color: '#818CF8' }}>same page.</span>
          </h1>

          <p style={{ fontSize: '1.125rem', color: '#94A3B8', lineHeight: 1.65, maxWidth: '600px', margin: 0 }}>
            Scheduling, EVV, authorizations, credentialing, and audit — connected in one calm workspace built for Pennsylvania home care agencies.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            <Link to="/contact" style={{ backgroundColor: '#6366F1', color: 'white', textDecoration: 'none', padding: '0.8125rem 1.75rem', borderRadius: '9px', fontWeight: 700, fontSize: '0.9375rem', boxShadow: '0 4px 20px rgba(99,102,241,0.45)', letterSpacing: '-0.01em' }}>
              Book a demo
            </Link>
            <a href="#features" style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: '#E2E8F0', textDecoration: 'none', padding: '0.8125rem 1.75rem', borderRadius: '9px', fontWeight: 600, fontSize: '0.9375rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              See what's inside
            </a>
          </div>

          {/* HIPAA trust badge */}
          <Link to="/compliance/hipaa" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'none', letterSpacing: '0.04em', marginTop: '0.25rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 12l2 2 4-4" /><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            HIPAA-compliant infrastructure
          </Link>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div style={{ backgroundColor: '#0F172A', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0 2.5rem 3rem' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ padding: '1.5rem 1.25rem', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#818CF8', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.4rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '6rem 2.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', margin: '0 0 0.75rem' }}>What's inside</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0F172A', margin: '0 0 1rem', letterSpacing: '-0.025em', lineHeight: 1.15 }}>One workspace. Every workflow.</h2>
            <p style={{ color: '#64748B', fontSize: '1.0625rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.65 }}>Roadmap items tagged honestly — no overclaiming.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {features.map((f) => (
              <div key={f.title} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.75rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.875rem', position: 'relative', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: f.live ? 'rgba(99,102,241,0.1)' : '#F1F5F9', color: f.live ? '#6366F1' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>{f.title}</h3>
                    {!f.live && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', backgroundColor: '#F1F5F9', padding: '2px 7px', borderRadius: '999px' }}>Roadmap</span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ backgroundColor: '#0F172A', padding: '6rem 2.5rem', color: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818CF8', margin: '0 0 0.75rem' }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Authorization to audit-ready visit.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {steps.map((step, i) => (
              <div key={step.n} style={{ padding: '2rem 1.75rem', backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#6366F1', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>STEP {step.n}</div>
                <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#F1F5F9', lineHeight: 1.25 }}>{step.title}</h3>
                <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section id="roles" style={{ padding: '6rem 2.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', margin: '0 0 0.75rem' }}>Who it's for</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Four roles. One shared source of truth.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
            {roles.map((role) => (
              <div key={role.label} style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.75rem', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <h3 style={{ margin: '0 0 1.125rem', fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>{role.label}</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {role.points.map((p) => (
                    <li key={p} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.875rem', color: '#475569' }}>
                      <span style={{ color: '#6366F1', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2, flexShrink: 0 }}>›</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section id="compliance" style={{ backgroundColor: '#F1F5F9', padding: '6rem 2.5rem', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', margin: '0 0 0.75rem' }}>Compliance</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0F172A', margin: '0 0 1rem', letterSpacing: '-0.025em', lineHeight: 1.15 }}>Built for the frameworks auditors use.</h2>
            <p style={{ color: '#64748B', fontSize: '1.0625rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>Compliance is the schema, the validation layer, and the audit trail — not a checkbox.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            {compliance.map((c) => (
              <div key={c.name} style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '1.75rem', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <div style={{ display: 'inline-block', backgroundColor: '#EEF2FF', color: '#4F46E5', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px', marginBottom: '0.875rem' }}>{c.badge}</div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>{c.name}</h3>
                <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '6rem 2.5rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366F1', margin: '0 0 0.75rem' }}>FAQ</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.025em' }}>Common questions.</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {faqs.map((f) => (
              <details key={f.q} style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem 1.5rem', cursor: 'pointer' }}>
                <summary style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  {f.q}
                  <span aria-hidden style={{ color: '#94A3B8', fontSize: '1.25rem', fontWeight: 300, flexShrink: 0 }}>+</span>
                </summary>
                <p style={{ color: '#64748B', lineHeight: 1.65, margin: '0.875rem 0 0', fontSize: '0.9rem' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ backgroundColor: '#0F172A', padding: '6rem 2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <h2 style={{ color: 'white', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', margin: 0, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Ready to retire the spreadsheets?</h2>
          <p style={{ color: '#64748B', fontSize: '1.0625rem', lineHeight: 1.65, maxWidth: '520px', margin: 0 }}>
            Get a live walkthrough of the admin portal and the caregiver mobile flow. Bring your hardest workflow.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            <Link to="/contact" style={{ backgroundColor: '#6366F1', color: 'white', textDecoration: 'none', padding: '0.8125rem 1.75rem', borderRadius: '9px', fontWeight: 700, fontSize: '0.9375rem', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}>
              Book a demo
            </Link>
            <Link to="/login" style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: '#E2E8F0', textDecoration: 'none', padding: '0.8125rem 1.75rem', borderRadius: '9px', fontWeight: 600, fontSize: '0.9375rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              Access admin portal
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ backgroundColor: '#020617', color: '#475569', padding: '2.5rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8125rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: '#334155' }}>© {new Date().getFullYear()} RayHealthEVV™</span>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/compliance/hipaa" style={{ color: '#475569', textDecoration: 'none' }}>HIPAA</Link>
            <Link to="/privacy" style={{ color: '#475569', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/launch" style={{ color: '#475569', textDecoration: 'none' }}>What's new</Link>
            <span style={{ color: '#1E293B' }}>Pennsylvania-built · Cures Act compliant</span>
          </div>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
