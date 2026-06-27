import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';

/* ── palette / type ── */

const PAPER = '#FBFAF7';
const INK = '#14131A';
const MUTED = '#6E6C78';
const HAIR = '#E6E2D8';
const LIVE = '#1C7A4D';
const ROAD = '#9A7B16';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
const MAXW = '1180px';

/* ── data ── */

const stats = [
  { value: '30s', label: 'Haptic clock-in' },
  { value: '<5m', label: 'GPS accuracy' },
  { value: '6/6', label: 'Cures Act elements' },
  { value: '100%', label: 'PA DHS aligned' },
];

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const features = [
  {
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Scheduling',
    body: 'Drag visits onto the week. Credential and authorization conflicts are caught as you build.',
    live: true,
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: 'EVV by default',
    body: 'GPS-verified clock-in and clock-out, accurate to a few meters. All six federal EVV elements captured on every visit.',
    live: true,
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    ),
    title: 'Care plans & tasks',
    body: 'PA task codes 106–256 built in. Goals and duty codes the caregiver actually reads before the visit starts.',
    live: true,
  },
  {
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Audit trail',
    body: 'Every state change — login, logout, CSRF failure, PHI read — is appended to an immutable event log with actor, outcome, and payload.',
    live: true,
  },
  {
    icon: (
      <svg {...iconProps}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Billing readiness',
    body: 'Spot claim blockers before they reach the payer — units, dates, EVV status, and documentation gaps surfaced in one queue.',
    live: false,
  },
  {
    icon: (
      <svg {...iconProps}>
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

/* ── small pieces ── */

function Kicker({ children, color = MUTED }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>
      <span aria-hidden style={{ width: '1.75rem', height: '1px', backgroundColor: color, opacity: 0.5 }} />
      {children}
    </span>
  );
}

function SectionTitle({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 600, lineHeight: 1.04, letterSpacing: '-0.02em', margin: 0, color: light ? PAPER : INK }}>
      {children}
    </h2>
  );
}

const inkButton: React.CSSProperties = {
  backgroundColor: INK, color: PAPER, textDecoration: 'none',
  padding: '0.875rem 1.6rem', borderRadius: '2px', fontWeight: 600,
  fontSize: '0.9375rem', letterSpacing: '-0.01em', display: 'inline-block',
};
const ghostButton: React.CSSProperties = {
  backgroundColor: 'transparent', color: INK, textDecoration: 'none',
  padding: '0.875rem 1.6rem', borderRadius: '2px', fontWeight: 600,
  fontSize: '0.9375rem', letterSpacing: '-0.01em', border: `1px solid ${INK}`, display: 'inline-block',
};

/* ── page ── */

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: PAPER, color: INK, fontFamily: 'var(--font-body)' }}>

      {/* ── Banner ── */}
      <div style={{ backgroundColor: INK, color: PAPER, padding: '0.5rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.02em' }}>
        Now live for Pennsylvania agencies{'  '}
        <Link to="/launch" style={{ color: PAPER, textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: 600 }}>See what shipped →</Link>
      </div>

      {/* ── Masthead ── */}
      <header style={{ backgroundColor: PAPER, borderBottom: `1px solid ${HAIR}`, padding: '0 2.5rem', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '0.55rem' }}>
          <span style={{ fontFamily: SERIF, color: INK, fontWeight: 600, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>RayHealth</span>
          <span style={{ color: MUTED, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>EVV</span>
        </Link>
        <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {[
            { to: '/pricing', label: 'Pricing' },
            { to: '/demo', label: 'Demo' },
            { to: '/contact', label: 'Contact' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{ color: INK, textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}>
              {label}
            </Link>
          ))}
          <Link to="/login" style={{ ...inkButton, padding: '0.5rem 1.1rem', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
            Log in
          </Link>
        </nav>
      </header>

      {/* ── Hero (editorial, asymmetric) ── */}
      <section style={{ borderBottom: `1px solid ${HAIR}`, padding: '0 2.5rem' }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0', padding: '5.5rem 0 4rem' }}>
          <Kicker>Pennsylvania&nbsp;·&nbsp;home-care operations platform</Kicker>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(3rem, 8.5vw, 7rem)', fontWeight: 600, lineHeight: 0.96, letterSpacing: '-0.035em', margin: '1.5rem 0 0', maxWidth: '14ch' }}>
            Home care, run like operations.
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'end', marginTop: '2.5rem' }}>
            <p style={{ fontSize: '1.1875rem', color: MUTED, lineHeight: 1.6, maxWidth: '46ch', margin: 0 }}>
              Scheduling, EVV, authorizations, credentialing, and audit — connected in one calm
              workspace built for Pennsylvania home-care agencies.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/contact" style={inkButton}>Book a demo</Link>
              <a href="#features" style={ghostButton}>See what&rsquo;s inside</a>
            </div>
          </div>
        </div>

        {/* Stats as an editorial figure row */}
        <div style={{ maxWidth: MAXW, margin: '0 auto', borderTop: `1px solid ${HAIR}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{ padding: '1.75rem 1.5rem 2rem', borderLeft: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
              <div style={{ fontFamily: SERIF, fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: INK }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: '0.5rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '6rem 2.5rem', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto' }}>
          <div style={{ maxWidth: '620px', marginBottom: '3.5rem' }}>
            <Kicker>What&rsquo;s inside</Kicker>
            <div style={{ marginTop: '1rem' }}><SectionTitle>One workspace.<br />Every workflow.</SectionTitle></div>
            <p style={{ color: MUTED, fontSize: '1.0625rem', margin: '1rem 0 0', lineHeight: 1.6 }}>Roadmap items are tagged honestly — no overclaiming.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', borderTop: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}` }}>
            {features.map((f, i) => (
              <div key={f.title} style={{ padding: '2rem 2rem 2.25rem', borderRight: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, backgroundColor: PAPER, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: f.live ? INK : MUTED, display: 'flex' }}>{f.icon}</span>
                  <span style={{ fontFamily: SERIF, fontSize: '1.25rem', color: HAIR, fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>{f.title}</h3>
                    {f.live ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: LIVE }}>
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: LIVE }} /> Live
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ROAD, border: `1px solid ${ROAD}33`, padding: '1px 6px', borderRadius: '2px' }}>Roadmap</span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: MUTED, fontSize: '0.9375rem', lineHeight: 1.6 }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works (dark contrast section) ── */}
      <section id="how" style={{ backgroundColor: INK, color: PAPER, padding: '6rem 2.5rem' }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem', maxWidth: '620px' }}>
            <Kicker color="#A8A6B0">How it works</Kicker>
            <div style={{ marginTop: '1rem' }}><SectionTitle light>Authorization to audit-ready visit.</SectionTitle></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0' }}>
            {steps.map((step, i) => (
              <div key={step.n} style={{ padding: '0 1.75rem', borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontFamily: SERIF, fontSize: '3.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.22)', lineHeight: 1, letterSpacing: '-0.03em' }}>{step.n}</div>
                <h3 style={{ margin: '1.25rem 0 0.6rem', fontSize: '1.0625rem', fontWeight: 700, color: PAPER, lineHeight: 1.25 }}>{step.title}</h3>
                <p style={{ margin: 0, color: '#A8A6B0', fontSize: '0.9375rem', lineHeight: 1.6 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section id="roles" style={{ padding: '6rem 2.5rem', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem', maxWidth: '620px' }}>
            <Kicker>Who it&rsquo;s for</Kicker>
            <div style={{ marginTop: '1rem' }}><SectionTitle>Four roles. One source of truth.</SectionTitle></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '2.5rem' }}>
            {roles.map((role) => (
              <div key={role.label}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: INK, paddingBottom: '0.75rem', borderBottom: `2px solid ${INK}` }}>{role.label}</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {role.points.map((p) => (
                    <li key={p} style={{ fontSize: '0.9375rem', color: MUTED, lineHeight: 1.4 }}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section id="compliance" style={{ padding: '6rem 2.5rem', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem', maxWidth: '620px' }}>
            <Kicker>Compliance</Kicker>
            <div style={{ marginTop: '1rem' }}><SectionTitle>Built for the frameworks auditors use.</SectionTitle></div>
            <p style={{ color: MUTED, fontSize: '1.0625rem', margin: '1rem 0 0', lineHeight: 1.6 }}>Compliance is the schema, the validation layer, and the audit trail — not a checkbox.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2.5rem' }}>
            {compliance.map((c) => (
              <div key={c.name}>
                <div style={{ fontFamily: SERIF, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', color: LIVE, marginBottom: '0.875rem' }}>{c.badge}</div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: INK }}>{c.name}</h3>
                <p style={{ margin: 0, color: MUTED, fontSize: '0.9375rem', lineHeight: 1.6 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '6rem 2.5rem', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3rem' }}>
            <Kicker>FAQ</Kicker>
            <div style={{ marginTop: '1rem' }}><SectionTitle>Common questions.</SectionTitle></div>
          </div>
          <div style={{ borderTop: `1px solid ${HAIR}` }}>
            {faqs.map((f) => (
              <details key={f.q} style={{ borderBottom: `1px solid ${HAIR}`, padding: '1.5rem 0', cursor: 'pointer' }}>
                <summary style={{ fontWeight: 700, color: INK, fontSize: '1.0625rem', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  {f.q}
                  <span aria-hidden style={{ color: MUTED, fontSize: '1.5rem', fontWeight: 300, flexShrink: 0, lineHeight: 1 }}>+</span>
                </summary>
                <p style={{ color: MUTED, lineHeight: 1.65, margin: '1rem 0 0', fontSize: '0.9375rem', maxWidth: '60ch' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ backgroundColor: INK, color: PAPER, padding: '7rem 2.5rem' }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2.5rem', alignItems: 'end' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em', margin: 0, color: PAPER }}>
            Retire the spreadsheets.
          </h2>
          <div>
            <p style={{ color: '#A8A6B0', fontSize: '1.0625rem', lineHeight: 1.6, margin: '0 0 1.75rem', maxWidth: '48ch' }}>
              A live walkthrough of the admin portal and the caregiver mobile flow. Bring your hardest workflow.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/contact" style={{ ...inkButton, backgroundColor: PAPER, color: INK }}>Book a demo</Link>
              <Link to="/login" style={{ ...ghostButton, color: PAPER, borderColor: 'rgba(255,255,255,0.35)' }}>Access admin portal</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ backgroundColor: PAPER, color: MUTED, padding: '2.5rem', borderTop: `1px solid ${HAIR}`, fontSize: '0.8125rem' }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span>© {new Date().getFullYear()} RayHealthEVV™ · Pennsylvania-built</span>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/compliance/hipaa" style={{ color: MUTED, textDecoration: 'none' }}>HIPAA</Link>
            <Link to="/privacy" style={{ color: MUTED, textDecoration: 'none' }}>Privacy</Link>
            <Link to="/launch" style={{ color: MUTED, textDecoration: 'none' }}>What&rsquo;s new</Link>
          </div>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
