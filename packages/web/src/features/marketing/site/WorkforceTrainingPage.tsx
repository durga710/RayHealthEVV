import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Workforce & Training.
 * How RayHealth operates hiring, credentialing, the EVV Academy, and
 * eligibility gating as one connected module wired into scheduling.
 */

const pillars = [
  { t: 'Credential & screening vault', b: 'Every clearance, background check, license, and health record in one place, each with an expiration the platform watches.',
    i: mkic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h6" /></>) },
  { t: 'EVV Academy (built-in LMS)', b: 'Assign lessons and quizzes, track completion, and issue certificates, no separate learning system to reconcile.',
    i: mkic(<><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" /></>) },
  { t: 'Eligibility gating', b: 'Scheduling reads the worker’s record in real time. Anyone with an expired credential or overdue training simply can’t be assigned.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>) },
  { t: 'Renewal alerts', b: 'Expiring credentials and due training surface weeks ahead, to the coordinator and the caregiver, so nothing lapses mid-schedule.',
    i: mkic(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>) },
  { t: 'Caregiver mobile learning', b: 'Field staff complete training, quizzes, and renewals from the same phone they clock in with, between visits, on their time.',
    i: mkic(<><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 18h6" /></>) },
  { t: 'Training compliance reporting', b: 'A live rollup of who is current, who is overdue, and what expires next, export-ready for a PA DHS review.',
    i: mkic(<><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="13" y="7" width="3" height="10" /></>) },
];

const lifecycle = [
  { n: '01', t: 'Apply & interview', b: 'Applicants apply to your agency through a branded link; structured interviews capture the right detail from day one.' },
  { n: '02', t: 'Onboard & collect', b: 'Documents, agreements, and identity records are gathered and stored against the caregiver’s profile.' },
  { n: '03', t: 'Credential', b: 'Background checks, clearances, TB tests, CPR, and licenses are logged with issue and expiration dates.' },
  { n: '04', t: 'Train in the Academy', b: 'Assign EVV Academy courses and PA-required hours; track completion and quiz scores per worker.' },
  { n: '05', t: 'Verify & schedule', b: 'The eligibility engine confirms credentials and training before a caregiver can be placed on a visit.' },
  { n: '06', t: 'Renew automatically', b: 'Alerts fire before anything expires, so renewals happen ahead of the schedule, not after a denial.' },
];

const stats = [
  { v: '6+', l: 'Credential types tracked per caregiver' },
  { v: '0', l: 'Assignments with an expired credential' },
  { v: '12 hrs', l: 'Annual PA training, tracked automatically' },
  { v: '100%', l: 'Visibility into upcoming renewals' },
];

const faqs = [
  { q: 'What credentials and records does RayHealth track?', a: 'Background checks and clearances (including FBI/state where applicable), TB tests and health records, CPR/first-aid, professional licenses, signed agreements, and any agency-specific document, each with issue and expiration dates.' },
  { q: 'How does eligibility gating actually work?', a: 'When a coordinator builds the schedule, RayHealth checks the caregiver’s live record. If a required credential is expired or training is overdue, the assignment is blocked with the exact reason, so non-compliant visits never get published.' },
  { q: 'Can caregivers complete training on their phones?', a: 'Yes. The EVV Academy runs in the same mobile app caregivers use to clock in, so lessons, quizzes, and certificate renewals happen in the field between visits.' },
  { q: 'How does this map to Pennsylvania’s training rules?', a: 'RayHealth tracks annual training hours and competencies aligned to PA §52.18, with a per-agency rollup that shows exactly who is current and what is due, ready to export for a DHS review.' },
];

const Chrome = ({ url }: { url: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '0 4px 14px' }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
    <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--mut)', fontWeight: 500 }}>{url}</span>
  </div>
);

const pill = (bg: string, c: string, text: string) => (
  <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '.2rem .5rem', borderRadius: 999, background: bg, color: c }}>{text}</span>
);

export function WorkforceTrainingPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Solutions · Workforce &amp; Training</span>
          <h1 className="mk-h1">Hire, credential, and train, without leaving operations.</h1>
          <p className="mk-lead">
            RayHealth&rsquo;s Workforce &amp; Training module connects recruiting, credentialing, and the EVV Academy
            to the schedule itself. A caregiver who isn&rsquo;t current simply can&rsquo;t be assigned, so compliance
            is enforced, not chased.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">Book a demo</Link>
            <a href="#how" className="mk-btn mk-ghost">See how it operates</a>
          </div>
        </div>
      </header>

      {/* Pillars */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">One connected module</p>
          <h2 className="mk-h2">Everything between hire and renewal.</h2>
          <p className="mk-deck">Recruiting, credentialing, and training stop living in three systems and a spreadsheet, and start enforcing each other.</p>
          <div className="mk-grid">
            {pillars.map((p) => (
              <div className="mk-card" key={p.t}>
                <div className="mk-ficon">{p.i}</div>
                <h3>{p.t}</h3>
                <p>{p.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lifecycle / how it operates */}
      <section id="how" className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">How it operates</p>
          <h2 className="mk-h2">The caregiver lifecycle, end to end.</h2>
          <p className="mk-deck">Each stage feeds the next, and the schedule reads the result, so eligibility is never a manual check.</p>
          <div className="mk-steps" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {lifecycle.map((s) => (
              <div className="mk-step" key={s.n}>
                <div className="sn">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dives with crafted visuals */}
      <section className="mk-sec">
        <div className="mk-wrap">
          {/* Credential vault */}
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">Credential vault</p>
              <h3>Every record, every expiration, watched.</h3>
              <p>Each caregiver carries a living file. RayHealth flags what&rsquo;s expiring before it becomes a coverage problem, and ties that status straight to scheduling.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Issue and expiration dates on every credential</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Color-coded status: valid, expiring, expired</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Document uploads stored per worker, scoped to your agency</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com · Maria Santos" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                {[
                  { n: 'Background check', s: 'Valid', c: '#16a34a', bg: '#e7f6ec', d: 'Expires Apr 2027' },
                  { n: 'TB test', s: 'Valid', c: '#16a34a', bg: '#e7f6ec', d: 'Expires Nov 2026' },
                  { n: 'FBI clearance', s: 'Expiring', c: '#b45309', bg: '#fdf1e3', d: 'In 14 days' },
                  { n: 'CPR / First aid', s: 'Valid', c: '#16a34a', bg: '#e7f6ec', d: 'Expires Jan 2027' },
                ].map((r, i) => (
                  <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div><div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>{r.n}</div><div style={{ color: 'var(--mut)', fontSize: '.72rem' }}>{r.d}</div></div>
                    {pill(r.bg, r.c, r.s)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* EVV Academy */}
          <div className="mk-feat rev">
            <div className="mk-feattext">
              <p className="mk-eylabel">EVV Academy</p>
              <h3>Training that lives where the work does.</h3>
              <p>Assign a course, watch completion climb, and issue the certificate, all inside RayHealth. Caregivers learn on the same app they clock in with.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Lessons, quizzes, and pass thresholds per course</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Automatic certificates and renewal reminders</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Annual PA hours tracked against §52.18</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="EVV Academy · EVV Fundamentals" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>EVV Fundamentals</div>
                  {pill('#e7f3f4', '#0c5d66', '80% complete')}
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'var(--surface)', marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ width: '80%', height: '100%', background: 'linear-gradient(90deg,#107480,#5fd0d6)' }} />
                </div>
                <div style={{ marginTop: 14 }}>
                  {[
                    { m: 'The six federal EVV elements', done: true },
                    { m: 'GPS clock-in & clock-out', done: true },
                    { m: 'Handling offline & telephony', done: true },
                    { m: 'Quiz · 8 questions', done: false },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: '.85rem', color: 'var(--ink-soft)' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', background: m.done ? '#e7f6ec' : 'var(--surface)', color: m.done ? '#16a34a' : 'var(--mut)', border: m.done ? 'none' : '1px solid var(--line)' }}>{m.done ? mkic(MK_CHECK) : null}</span>
                      {m.m}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Eligibility gating */}
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">Eligibility gating</p>
              <h3>Non-compliant visits never get published.</h3>
              <p>The schedule and the workforce record are the same source of truth. Try to assign a caregiver who isn&rsquo;t current and RayHealth stops you, with the exact reason and the fix.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Real-time credential &amp; training checks at assignment</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Clear, specific block reasons, not silent failures</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>One click to the record that needs renewing</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com · Assign caregiver" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.9rem' }}>Wed · 10:00 AM · A. Brooks</div>
                  {pill('#fdecec', '#b91c1c', 'Blocked')}
                </div>
                <div style={{ display: 'flex', gap: '.6rem', marginTop: 12, padding: 12, background: '#fdecec', borderRadius: 10, border: '1px solid #f6d4d4' }}>
                  <span style={{ color: '#b91c1c', flexShrink: 0 }}>{mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>)}</span>
                  <div style={{ fontSize: '.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                    <strong>Cannot assign R. Vance.</strong> CPR / First aid expired 3 days ago. Renew the credential or choose an eligible caregiver.
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: '.8rem', color: 'var(--accent-deep)', fontWeight: 600 }}>Open credential record →</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PA §52.18 callout */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, alignItems: 'center' }} className="mk-pa">
            <div>
              <p className="mk-eylabel">Pennsylvania-specific</p>
              <h2 className="mk-h2">Built around PA §52.18 training rules.</h2>
              <p className="mk-deck">Pennsylvania requires ongoing caregiver training and documented competency. RayHealth tracks annual hours, ties completions to each worker, and keeps the evidence audit-ready, so &ldquo;are we compliant?&rdquo; is a dashboard, not a fire drill.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Annual training hours tracked per caregiver</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Competency completions stored with dates</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Per-agency rollup, exportable for DHS</li>
              </ul>
            </div>
            <div className="mk-card" style={{ background: 'var(--paper)' }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Training compliance · this quarter</div>
              {[
                { l: 'Current on annual hours', v: '83%', c: '#16a34a' },
                { l: 'In progress', v: '12%', c: '#b45309' },
                { l: 'Overdue', v: '5%', c: '#b91c1c' },
              ].map((r) => (
                <div key={r.l} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', color: 'var(--ink-soft)' }}><span>{r.l}</span><span style={{ fontWeight: 600, color: r.c }}>{r.v}</span></div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--surface)', marginTop: 6, overflow: 'hidden' }}><div style={{ width: r.v, height: '100%', background: r.c }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-stats">
            {stats.map((s) => (
              <div className="mk-stat" key={s.l}><div className="v">{s.v}</div><div className="l">{s.l}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">Workforce &amp; training, answered.</h2></div>
          <div className="mk-faqs">
            {faqs.map((f) => (
              <div className="mk-faq" key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>See eligibility gating on your roster.</h2>
            <p>We&rsquo;ll load a sample caregiver, expire a credential, and show you the schedule refuse the assignment in real time.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/solutions/scheduling" className="mk-btn mk-outline">Explore scheduling</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
