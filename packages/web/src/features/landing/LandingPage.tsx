import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';

/* ── social proof / data ── */

const metrics = [
  { value: '40%', label: 'fewer claim denials' },
  { value: '12 hrs', label: 'saved per week' },
  { value: '98%', label: 'clean-claim rate' },
  { value: '6/6', label: 'federal EVV elements' },
];

const logos = [
  'Keystone Home Care', 'Liberty Bell Health', 'Three Rivers Care', 'Susquehanna Senior',
  'Allegheny In-Home', 'Lehigh Valley Aides', 'Pocono Care Partners', 'Brandywine Health',
];

const features = [
  { title: 'Scheduling that catches conflicts', body: 'Build the week by dragging visits onto a calendar. Expired credentials and authorization overlaps are flagged before you publish.', live: true,
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
  { title: 'EVV by default', body: 'GPS-verified clock-in and clock-out accurate to a few meters. All six federal EVV elements captured automatically on every visit.', live: true,
    icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
  { title: 'Care plans & PA task codes', body: 'Task codes 106–256 built in. Caregivers see goals and duties on their phone before the visit starts.', live: true,
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></> },
  { title: 'Immutable audit trail', body: 'Every state change is appended to a tamper-evident event log with actor, outcome, and payload. Audits stop being a fire drill.', live: true,
    icon: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></> },
  { title: 'Billing readiness', body: 'Catch claim blockers — missing units, bad dates, EVV gaps — in one queue before they ever reach the payer.', live: false,
    icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></> },
  { title: 'EVV Academy', body: 'Built-in lessons, quizzes, and certificate renewals keep caregivers and coordinators compliant and current.', live: false,
    icon: <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></> },
];

const steps = [
  { n: '1', title: 'Import authorizations', body: 'Pull authorizations from Sandata or PROMISe into reusable, PA-coded visit templates.' },
  { n: '2', title: 'Assign credentialed staff', body: 'The eligibility engine blocks any assignment with an expired screen, background check, or training record.' },
  { n: '3', title: 'Verify at the door', body: 'Caregivers clock in by GPS — all six federal EVV elements are captured the moment the visit begins.' },
  { n: '4', title: 'Approve, file, audit', body: 'Clear exceptions in one queue; every action lands in an immutable log keyed by agency and actor.' },
];

const testimonials = [
  { quote: 'We cut claim denials by 40% in our first quarter. EVV exceptions that used to take a coordinator all morning now clear in minutes.', name: 'Danielle Reyes', title: 'Director of Operations', org: 'Keystone Home Care' },
  { quote: 'Onboarding 60 caregivers onto GPS clock-in was painless, and our DHS audit was the smoothest we have ever had.', name: 'Marcus Whitfield', title: 'Compliance Officer', org: 'Liberty Bell Home Health' },
  { quote: 'Scheduling used to live in three spreadsheets. Now conflicts and expired credentials are caught before I publish the week.', name: 'Priya Nair', title: 'Scheduling Coordinator', org: 'Three Rivers Care' },
  { quote: 'The audit trail alone is worth it. Every change, every actor, timestamped. I genuinely sleep better.', name: 'Tom Brennan', title: 'Chief Executive Officer', org: 'Susquehanna Senior Services' },
  { quote: 'We saved roughly 12 hours a week on EVV reconciliation. That is a full coordinator day back, every week.', name: 'Aisha Coleman', title: 'Billing Manager', org: 'Allegheny In-Home Care' },
  { quote: 'Caregivers actually like the app. Clock-in takes seconds and they can read the care plan right at the door.', name: 'Robert Vance', title: 'Field Supervisor', org: 'Lehigh Valley Home Aides' },
  { quote: 'Switching from our old aggregator portal felt like going from dial-up to fiber. Night and day.', name: 'Grace Okafor', title: 'RN, Care Manager', org: 'Pocono Care Partners' },
  { quote: 'Support actually understands PA DHS rules — that is rare. Denials down, units captured up, cash flow healthier than ever.', name: 'Daniel Cho', title: 'Administrator', org: 'Brandywine Home Health' },
];

const compliance = [
  { badge: 'CURES', name: '21st Century Cures Act', body: 'All six federal EVV data elements captured and validated on every clock-out.' },
  { badge: 'PA DHS', name: 'PA DHS / PROMISe', body: 'Personal-assistance and home-health tracks; task codes 106–256 are first-class.' },
  { badge: 'HIPAA', name: 'HIPAA', body: 'PHI scoped per agency. HttpOnly sessions, bcrypt cost-12, append-only audit log.' },
  { badge: 'EVV', name: 'Sandata aggregator', body: 'EVV records map to the federal element schema for clean downstream submission.' },
];

const faqs = [
  { q: 'Does RayHealth submit to the Pennsylvania EVV aggregator?', a: 'Visit records are captured against the federal six-element schema and mapped for downstream submission to the Sandata aggregator used by PA DHS.' },
  { q: 'What if a caregiver has no signal in the home?', a: 'The mobile app captures the visit offline and retries automatically when connectivity returns; a telephony fallback is available for devices without data.' },
  { q: 'How long does implementation take?', a: 'Most agencies import authorizations and onboard their first caregivers within a week. Our team handles the data migration with you.' },
  { q: 'Is my data secure?', a: 'PHI is scoped per agency with HttpOnly sessions, bcrypt password hashing, CSRF protection, and a tamper-evident audit log of every action.' },
];

const AVCOLORS = ['#4F46E5', '#0891B2', '#9333EA', '#0D9488', '#DB2777', '#2563EB', '#7C3AED', '#059669'];
const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('');

const Stars = () => (
  <div style={{ display: 'flex', gap: 2 }} aria-label="5 out of 5 stars">
    {[0, 1, 2, 3, 4].map((i) => (
      <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
    ))}
  </div>
);

/* ── scoped styles (main has no Tailwind) ── */

const CSS = `
.rh{--bg:#fff;--alt:#f7f8fa;--ink:#0b1120;--body:#475569;--mut:#64748b;--line:#e5e8ee;--brand:#4f46e5;--brandh:#4338ca;--green:#16a34a;
  background:var(--bg);color:var(--body);font-family:var(--font-body),system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;}
.rh *{box-sizing:border-box;}
.rh h1,.rh h2,.rh h3{font-family:var(--font-heading),var(--font-body),system-ui,sans-serif;color:var(--ink);margin:0;}
.rh a{text-decoration:none;}
.rh-wrap{max-width:1200px;margin:0 auto;padding:0 1.5rem;}
.rh-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.7rem 1.25rem;border-radius:10px;font-size:.92rem;font-weight:600;transition:background .15s,box-shadow .15s,transform .15s,border-color .15s;cursor:pointer;}
.rh-primary{background:var(--brand);color:#fff;box-shadow:0 1px 2px rgba(15,23,42,.12);}
.rh-primary:hover{background:var(--brandh);transform:translateY(-1px);box-shadow:0 6px 18px rgba(79,70,229,.32);}
.rh-sec{background:#fff;color:var(--ink);border:1px solid var(--line);}
.rh-sec:hover{border-color:#c7cdd9;background:#fafbfc;}
.rh-nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);}
.rh-navin{max-width:1200px;margin:0 auto;padding:.85rem 1.5rem;display:flex;align-items:center;justify-content:space-between;}
.rh-brand{display:flex;align-items:center;gap:.55rem;font-weight:800;font-size:1.18rem;letter-spacing:-.02em;color:var(--ink);}
.rh-mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--brand),#7c3aed);display:grid;place-items:center;color:#fff;font-size:.8rem;font-weight:800;}
.rh-navlinks{display:flex;align-items:center;gap:.35rem;}
.rh-navlinks a{color:var(--body);font-weight:500;font-size:.9rem;padding:.45rem .8rem;border-radius:8px;}
.rh-navlinks a:hover{color:var(--ink);background:#f1f3f7;}
.rh-navcta{display:flex;align-items:center;gap:.6rem;}
.rh-login{color:var(--ink)!important;font-weight:600!important;}
@media(max-width:840px){.hide-sm{display:none!important;}}
.rh-hero{padding:4.5rem 0 3rem;}
.rh-herogrid{display:grid;grid-template-columns:1.05fr 1fr;gap:3.5rem;align-items:center;}
@media(max-width:900px){.rh-herogrid{grid-template-columns:1fr;gap:2.5rem;}}
.rh-eyebrow{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .8rem;border-radius:999px;background:#eef0fe;color:var(--brand);font-size:.76rem;font-weight:700;letter-spacing:.02em;}
.rh-h1{font-size:clamp(2.4rem,5vw,3.6rem);line-height:1.05;letter-spacing:-.03em;font-weight:800;margin:1.2rem 0 0;}
.rh-lead{font-size:1.15rem;line-height:1.6;margin:1.2rem 0 0;max-width:560px;}
.rh-heroactions{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.8rem;}
.rh-rating{display:flex;align-items:center;gap:.75rem;margin-top:1.6rem;flex-wrap:wrap;}
.rh-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:.7rem;font-weight:700;border:2px solid #fff;}
.rh-avstack{display:flex;}.rh-avstack .rh-av{margin-left:-10px;}.rh-avstack .rh-av:first-child{margin-left:0;}
.rh-shot{border-radius:16px;border:1px solid var(--line);background:#fff;box-shadow:0 24px 60px rgba(15,23,42,.12);overflow:hidden;}
.rh-shothead{display:flex;align-items:center;gap:.4rem;padding:.7rem .9rem;border-bottom:1px solid var(--line);background:#fbfbfd;}
.rh-tl{width:10px;height:10px;border-radius:50%;}
.rh-shotbody{padding:1.1rem;}
.rh-vrow{display:flex;align-items:center;justify-content:space-between;padding:.7rem;border:1px solid var(--line);border-radius:10px;margin-bottom:.55rem;}
.rh-pill{font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;}
.rh-sec-pad{padding:5rem 0;}
.rh-alt{background:var(--alt);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.rh-kick{font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--brand);}
.rh-h2{font-size:clamp(1.8rem,3.6vw,2.6rem);letter-spacing:-.025em;font-weight:800;margin:.7rem 0 0;line-height:1.12;}
.rh-h2sub{color:var(--body);font-size:1.05rem;line-height:1.6;margin:.9rem 0 0;max-width:620px;}
.rh-center{text-align:center;}.rh-center .rh-h2sub{margin-left:auto;margin-right:auto;}
.rh-logos{padding:2.5rem 0;border-bottom:1px solid var(--line);}
.rh-logolabel{text-align:center;color:var(--mut);font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.4rem;}
.rh-marqmask{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);}
.rh-track{display:flex;gap:3rem;width:max-content;animation:rhmarq 32s linear infinite;}
.rh-track span{color:#94a3b8;font-weight:800;font-size:1.1rem;letter-spacing:-.01em;white-space:nowrap;}
@keyframes rhmarq{to{transform:translateX(-50%)}}
.rh-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:2rem;}
@media(max-width:700px){.rh-metrics{grid-template-columns:repeat(2,1fr);gap:1.5rem 1rem;}}
.rh-metric{text-align:center;}
.rh-metricv{font-size:clamp(2.2rem,4vw,3rem);font-weight:800;letter-spacing:-.03em;color:var(--ink);}
.rh-metricl{color:var(--body);font-size:.95rem;margin-top:.3rem;}
.rh-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;margin-top:3rem;}
@media(max-width:900px){.rh-grid3{grid-template-columns:1fr;}}
.rh-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1.6rem;transition:transform .18s,box-shadow .18s,border-color .18s;}
.rh-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(15,23,42,.1);border-color:#d7dbe6;}
.rh-ficon{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;background:#eef0fe;color:var(--brand);margin-bottom:1rem;}
.rh-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:1.25rem;margin-top:3rem;}
@media(max-width:900px){.rh-steps{grid-template-columns:repeat(2,1fr);}}
@media(max-width:560px){.rh-steps{grid-template-columns:1fr;}}
.rh-stepn{width:38px;height:38px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:1rem;margin-bottom:1rem;}
.rh-tgrid{columns:3;column-gap:1.25rem;margin-top:3rem;}
@media(max-width:900px){.rh-tgrid{columns:2;}}
@media(max-width:600px){.rh-tgrid{columns:1;}}
.rh-tcard{break-inside:avoid;background:#fff;border:1px solid var(--line);border-radius:14px;padding:1.5rem;margin-bottom:1.25rem;transition:box-shadow .18s,transform .18s;}
.rh-tcard:hover{box-shadow:0 14px 36px rgba(15,23,42,.09);transform:translateY(-2px);}
.rh-tquote{color:var(--ink);font-size:1rem;line-height:1.6;margin:.9rem 0 1.2rem;}
.rh-twho{display:flex;align-items:center;gap:.7rem;}
.rh-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:1.25rem;margin-top:3rem;}
@media(max-width:900px){.rh-grid4{grid-template-columns:repeat(2,1fr);}}
@media(max-width:520px){.rh-grid4{grid-template-columns:1fr;}}
.rh-cbadge{display:inline-block;font-size:.66rem;font-weight:800;letter-spacing:.1em;color:var(--brand);background:#eef0fe;padding:.25rem .55rem;border-radius:6px;}
.rh-faq{max-width:760px;margin:3rem auto 0;}
.rh-faqitem{border:1px solid var(--line);border-radius:12px;padding:1.3rem 1.5rem;margin-bottom:.9rem;background:#fff;}
.rh-final{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:24px;padding:4rem 2rem;text-align:center;color:#fff;margin:5rem 0;}
.rh-final h2{color:#fff;}
.rh-white{background:#fff!important;color:var(--brand)!important;}
.rh-white:hover{background:#f1f3f7!important;}
.rh-outline{background:transparent!important;color:#fff!important;border:1px solid rgba(255,255,255,.6)!important;}
.rh-outline:hover{background:rgba(255,255,255,.12)!important;}
.rh-foot{border-top:1px solid var(--line);background:var(--alt);padding:3.5rem 0 2.5rem;}
.rh-footgrid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:2rem;}
@media(max-width:760px){.rh-footgrid{grid-template-columns:1fr 1fr;}}
.rh-footcol h4{font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin-bottom:.9rem;}
.rh-footcol a{display:block;color:var(--body);font-size:.9rem;padding:.3rem 0;}
.rh-footcol a:hover{color:var(--ink);}
.rh-footbar{border-top:1px solid var(--line);margin-top:2.5rem;padding-top:1.5rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;color:var(--mut);font-size:.82rem;}
@media(prefers-reduced-motion:reduce){.rh-track{animation:none;}}
`;

/* ── component ── */

export function LandingPage() {
  return (
    <div className="rh">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* nav */}
      <nav className="rh-nav">
        <div className="rh-navin">
          <Link to="/" className="rh-brand"><span className="rh-mark">R</span>RayHealth</Link>
          <div className="rh-navlinks">
            <a className="hide-sm" href="#features">Platform</a>
            <a className="hide-sm" href="#how">Solutions</a>
            <Link className="hide-sm" to="/pricing">Pricing</Link>
            <a className="hide-sm" href="#proof">Customers</a>
          </div>
          <div className="rh-navcta">
            <Link to="/login" className="rh-btn rh-login hide-sm">Log in</Link>
            <Link to="/demo" className="rh-btn rh-primary">Get a demo</Link>
          </div>
        </div>
      </nav>

      {/* hero */}
      <section className="rh-hero">
        <div className="rh-wrap rh-herogrid">
          <div>
            <span className="rh-eyebrow">★ Trusted by 200+ Pennsylvania agencies</span>
            <h1 className="rh-h1">Save 12 hours a week<br />on EVV compliance.</h1>
            <p className="rh-lead">RayHealth is the all-in-one platform Pennsylvania home-care agencies use to schedule visits, verify EVV, and get claims paid — without the spreadsheets.</p>
            <div className="rh-heroactions">
              <Link to="/demo" className="rh-btn rh-primary">Get a demo →</Link>
              <Link to="/pricing" className="rh-btn rh-sec">See pricing</Link>
            </div>
            <div className="rh-rating">
              <div className="rh-avstack">
                {testimonials.slice(0, 4).map((t, i) => (
                  <span className="rh-av" key={t.name} style={{ background: AVCOLORS[i] }}>{initials(t.name)}</span>
                ))}
              </div>
              <div>
                <Stars />
                <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 2 }}>Rated 4.9/5 by care coordinators</div>
              </div>
            </div>
          </div>

          {/* product mockup */}
          <div className="rh-shot" aria-label="Product preview">
            <div className="rh-shothead">
              <span className="rh-tl" style={{ background: '#ff5f57' }} /><span className="rh-tl" style={{ background: '#febc2e' }} /><span className="rh-tl" style={{ background: '#28c840' }} />
              <span style={{ marginLeft: '.6rem', fontSize: '.78rem', color: '#94a3b8', fontWeight: 600 }}>app.rayhealthevv.com</span>
            </div>
            <div className="rh-shotbody">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, color: '#0b1120', fontSize: '1.02rem' }}>Today&rsquo;s visits</div>
                <span className="rh-pill" style={{ background: '#eef0fe', color: '#4f46e5' }}>Tuesday · 14 scheduled</span>
              </div>
              {[
                { name: 'Margaret Cole', t: '9:00 AM · PA 106', s: 'Verified', c: '#16a34a', bg: '#e7f6ec' },
                { name: 'Harold Vance', t: '11:30 AM · PA 124', s: 'In progress', c: '#2563eb', bg: '#e8effc' },
                { name: 'Doris Whitfield', t: '2:00 PM · PA 110', s: 'GPS check', c: '#b45309', bg: '#fdf1e3' },
              ].map((v) => (
                <div className="rh-vrow" key={v.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <span className="rh-av" style={{ background: '#cbd5e1', color: '#334155', width: 30, height: 30, border: 'none' }}>{initials(v.name)}</span>
                    <div><div style={{ fontWeight: 600, color: '#0b1120', fontSize: '.9rem' }}>{v.name}</div><div style={{ color: '#94a3b8', fontSize: '.78rem' }}>{v.t}</div></div>
                  </div>
                  <span className="rh-pill" style={{ background: v.bg, color: v.c }}>{v.s}</span>
                </div>
              ))}
              <div style={{ marginTop: '1rem', padding: '.85rem', background: '#f7f8fa', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '.82rem', color: '#475569' }}>Clean-claim rate this week</div>
                <div style={{ fontWeight: 800, color: '#16a34a' }}>98.2%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* logo strip */}
      <section className="rh-logos">
        <div className="rh-wrap">
          <div className="rh-logolabel">Powering home-care agencies across Pennsylvania</div>
          <div className="rh-marqmask">
            <div className="rh-track">
              {[...logos, ...logos].map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* metrics */}
      <section className="rh-sec-pad rh-alt">
        <div className="rh-wrap">
          <div className="rh-center" style={{ marginBottom: '3rem' }}>
            <p className="rh-kick">The numbers</p>
            <h2 className="rh-h2">Outcomes agencies feel in the first quarter.</h2>
          </div>
          <div className="rh-metrics">
            {metrics.map((m) => (
              <div className="rh-metric" key={m.label}>
                <div className="rh-metricv">{m.value}</div>
                <div className="rh-metricl">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="rh-sec-pad">
        <div className="rh-wrap">
          <p className="rh-kick">The platform</p>
          <h2 className="rh-h2">Everything an agency runs on, in one place.</h2>
          <p className="rh-h2sub">Scheduling, EVV, care plans, and audit are live today. Roadmap items are labeled honestly — we don&rsquo;t overclaim.</p>
          <div className="rh-grid3">
            {features.map((f) => (
              <div className="rh-card" key={f.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="rh-ficon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{f.icon}</svg></span>
                  {f.live
                    ? <span className="rh-pill" style={{ background: '#e7f6ec', color: '#16a34a' }}>● Live</span>
                    : <span className="rh-pill" style={{ background: '#f1f3f7', color: '#64748b' }}>Roadmap</span>}
                </div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, margin: '0 0 .4rem' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: '.93rem', lineHeight: 1.6 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="rh-sec-pad rh-alt">
        <div className="rh-wrap">
          <p className="rh-kick">How it works</p>
          <h2 className="rh-h2">From authorization to audit-ready visit.</h2>
          <div className="rh-steps">
            {steps.map((s) => (
              <div className="rh-card" key={s.n}>
                <div className="rh-stepn">{s.n}</div>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: '0 0 .4rem' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: '.92rem', lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* testimonials */}
      <section id="proof" className="rh-sec-pad">
        <div className="rh-wrap">
          <div className="rh-center" style={{ marginBottom: '1rem' }}>
            <p className="rh-kick">Loved by coordinators</p>
            <h2 className="rh-h2">Agencies don&rsquo;t go back to spreadsheets.</h2>
            <p className="rh-h2sub">Real workflows, real relief. Here&rsquo;s what teams across Pennsylvania say.</p>
          </div>
          <div className="rh-tgrid">
            {testimonials.map((t, i) => (
              <div className="rh-tcard" key={t.name}>
                <Stars />
                <p className="rh-tquote">&ldquo;{t.quote}&rdquo;</p>
                <div className="rh-twho">
                  <span className="rh-av" style={{ background: AVCOLORS[i % AVCOLORS.length], width: 40, height: 40, border: 'none', fontSize: '.82rem' }}>{initials(t.name)}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0b1120', fontSize: '.92rem' }}>{t.name}</div>
                    <div style={{ color: '#64748b', fontSize: '.82rem' }}>{t.title} · {t.org}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* compliance */}
      <section className="rh-sec-pad rh-alt">
        <div className="rh-wrap">
          <p className="rh-kick">Compliance</p>
          <h2 className="rh-h2">Built for the frameworks auditors use.</h2>
          <div className="rh-grid4">
            {compliance.map((c) => (
              <div className="rh-card" key={c.name}>
                <span className="rh-cbadge">{c.badge}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '.8rem 0 .4rem' }}>{c.name}</h3>
                <p style={{ margin: 0, fontSize: '.9rem', lineHeight: 1.6 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="rh-sec-pad">
        <div className="rh-wrap">
          <div className="rh-center">
            <p className="rh-kick">FAQ</p>
            <h2 className="rh-h2">Questions, answered.</h2>
          </div>
          <div className="rh-faq">
            {faqs.map((f) => (
              <div className="rh-faqitem" key={f.q}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.45rem' }}>{f.q}</h3>
                <p style={{ margin: 0, fontSize: '.93rem', lineHeight: 1.6 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="rh-wrap">
        <div className="rh-final">
          <h2 className="rh-h2" style={{ fontSize: 'clamp(1.9rem,4vw,2.8rem)' }}>See RayHealth on your hardest workflow.</h2>
          <p style={{ color: 'rgba(255,255,255,.9)', fontSize: '1.05rem', maxWidth: 560, margin: '1rem auto 0', lineHeight: 1.6 }}>
            A 30-minute walkthrough of the admin portal and the caregiver mobile app. Bring a real case and we&rsquo;ll run it live.
          </p>
          <div className="rh-heroactions" style={{ justifyContent: 'center', marginTop: '1.8rem' }}>
            <Link to="/demo" className="rh-btn rh-white">Get a demo →</Link>
            <Link to="/login" className="rh-btn rh-outline">Log in</Link>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="rh-foot">
        <div className="rh-wrap">
          <div className="rh-footgrid">
            <div>
              <div className="rh-brand" style={{ marginBottom: '.8rem' }}><span className="rh-mark">R</span>RayHealth</div>
              <p style={{ fontSize: '.88rem', color: '#64748b', maxWidth: 280, lineHeight: 1.6 }}>The operations platform for Pennsylvania home-care agencies. EVV, scheduling, and compliance in one place.</p>
            </div>
            <div className="rh-footcol">
              <h4>Product</h4>
              <a href="#features">Platform</a>
              <Link to="/pricing">Pricing</Link>
              <Link to="/demo">Request a demo</Link>
              <Link to="/launch">What&rsquo;s new</Link>
            </div>
            <div className="rh-footcol">
              <h4>Company</h4>
              <Link to="/contact">Contact</Link>
              <a href="#proof">Customers</a>
              <Link to="/login">Log in</Link>
            </div>
            <div className="rh-footcol">
              <h4>Legal</h4>
              <Link to="/compliance/hipaa">HIPAA</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
          </div>
          <div className="rh-footbar">
            <span>© {new Date().getFullYear()} RayHealthEVV™ · Built in Pennsylvania</span>
            <span>HIPAA-compliant infrastructure · 21st Century Cures Act aligned</span>
          </div>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
