import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Platform › AI automation.
 * HONEST framing: most of this is roadmap / early-access, not shipped
 * everywhere. The throughline is human-in-the-loop — RayHealth proposes,
 * your team approves. Nothing is auto-submitted to a payer or auto-published
 * to a caregiver without a person signing off.
 */

interface Capability {
  eyebrow: string;
  status: string;
  title: string;
  body: string;
  checks: string[];
}

interface LoopReason {
  t: string;
  b: string;
  i: React.ReactNode;
}

interface Faq {
  q: string;
  a: string;
}

const loopReasons: readonly LoopReason[] = [
  {
    t: 'You stay accountable',
    b: 'A denied claim or a missed visit is your agency’s liability — not a model’s. Every AI suggestion is a draft a coordinator reviews and accepts before it becomes real.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  },
  {
    t: 'Reasons, not black boxes',
    b: 'Each proposal shows the why — the open authorization, the credential gap, the payer rule it’s checking against — so your team can sanity-check it instead of trusting blindly.',
    i: mkic(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  },
  {
    t: 'Care decisions stay human',
    b: 'Matching a caregiver to a client is a relationship, not just a slot. RayHealth ranks and drafts; your coordinators make the call that fits the family.',
    i: mkic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  },
  {
    t: 'It earns trust gradually',
    b: 'Start in suggest-only mode. As your team sees the drafts hold up, you decide how much to lean on them — automation is a dial you control, not a switch we flip.',
    i: mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  },
];

const capabilities: readonly Capability[] = [
  {
    eyebrow: 'In development',
    status: 'Schedule drafting',
    title: 'Drafts the schedule from open authorizations and availability.',
    body: 'RayHealth reads your open authorizations, caregiver availability, and eligibility, then proposes a draft schedule that covers the hours. Your coordinator reviews, adjusts, and publishes — nothing goes live on its own.',
    checks: [
      'Proposes assignments against authorized hours, not guesses',
      'Respects eligibility gating — never drafts a non-compliant visit',
      'Every draft is editable before a coordinator publishes it',
    ],
  },
  {
    eyebrow: 'Early access',
    status: 'Exception triage',
    title: 'Triages EVV and credential exceptions, ranked by claim risk.',
    body: 'Instead of a flat list of alerts, RayHealth groups and ranks exceptions — a missed clock-in, an expiring clearance, a manual edit — by how much billable revenue is at stake, so your team works the riskiest items first.',
    checks: [
      'Exceptions ranked by dollars and deadline at risk',
      'Each item links straight to the visit or record to fix',
      'A human resolves every exception — AI only prioritizes',
    ],
  },
  {
    eyebrow: 'Roadmap',
    status: 'Claim readiness',
    title: 'Checks claim-readiness against payer rules before submission.',
    body: 'Before a claim leaves your hands, RayHealth flags what a payer is likely to reject — a missing element, a code mismatch, an out-of-window visit — and suggests the fix. You decide what to correct and when to submit.',
    checks: [
      'Pre-submission checks against known PA payer rules',
      'Plain-language reasons for every flag it raises',
      'RayHealth never auto-submits — your biller hits send',
    ],
  },
];

const faqs: readonly Faq[] = [
  {
    q: 'Is RayHealth’s AI automation available today?',
    a: 'Honestly, not all of it. Schedule drafting and exception triage are in early access with selected agencies; claim-readiness checks are on the roadmap. We’d rather tell you exactly what’s shipped than oversell a feature you’re counting on. Ask us for the current state during a demo and we’ll show you what’s live versus in development.',
  },
  {
    q: 'Does the AI ever act on its own?',
    a: 'No. RayHealth proposes; your team approves. The platform drafts schedules, ranks exceptions, and flags claim risks — but a person reviews and confirms before anything is published to a caregiver or submitted to a payer. Automation runs in suggest-only mode by default.',
  },
  {
    q: 'How does it decide what to suggest?',
    a: 'Every suggestion is tied to data already in your account — open authorizations, caregiver availability and eligibility, EVV records, and documented payer rules. Each proposal shows its reasoning so your coordinators can verify it rather than trust a black box.',
  },
  {
    q: 'Will this replace my coordinators?',
    a: 'No. The goal is to remove the rote sorting and cross-checking so your coordinators spend their judgment where it matters — care relationships, edge cases, and the calls only a person should make. The human stays in the loop by design.',
  },
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

const SuggestBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', fontSize: '.68rem', fontWeight: 700, padding: '.2rem .5rem', borderRadius: 999, background: '#eef2ff', color: '#4338ca' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
    AI suggestion · review required
  </span>
);

function ScheduleVisual() {
  const slots = [
    { day: 'Mon', time: '8:00 AM', who: 'M. Santos', auth: 'Auth #4471 · 4 of 20 hrs' },
    { day: 'Mon', time: '1:00 PM', who: 'R. Okafor', auth: 'Auth #4471 · 8 of 20 hrs' },
    { day: 'Tue', time: '9:00 AM', who: 'L. Tran', auth: 'Auth #5520 · 6 of 12 hrs' },
  ];
  return (
    <div className="mk-visual">
      <Chrome url="app.rayhealthevv.com · Draft schedule" />
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>Proposed coverage · week of Jun 30</div>
          <SuggestBadge />
        </div>
        {slots.map((s, i) => (
          <div key={`${s.day}-${s.time}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>{s.day} · {s.time} · {s.who}</div>
              <div style={{ color: 'var(--mut)', fontSize: '.72rem' }}>{s.auth}</div>
            </div>
            {pill('#e7f3f4', '#0c5d66', 'Eligible')}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '.5rem', marginTop: 14 }}>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '.78rem', fontWeight: 600, color: '#fff', background: 'var(--accent)', borderRadius: 8, padding: '8px 0' }}>Review &amp; publish</span>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '.78rem', fontWeight: 600, color: 'var(--ink-soft)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 0' }}>Edit draft</span>
        </div>
      </div>
    </div>
  );
}

function TriageVisual() {
  const rows = [
    { sev: '#b91c1c', bg: '#fdecec', risk: '$412 at risk', t: 'Missed clock-out · Tue visit', d: 'Manual edit needed before billing window closes (2 days)' },
    { sev: '#b45309', bg: '#fdf1e3', risk: '$190 at risk', t: 'FBI clearance expiring', d: 'R. Vance · blocks 3 upcoming authorized visits' },
    { sev: '#0c5d66', bg: '#e7f3f4', risk: '$0 · informational', t: 'GPS drift on clock-in', d: 'Within tolerance · no action required' },
  ];
  return (
    <div className="mk-visual">
      <Chrome url="app.rayhealthevv.com · Exceptions, ranked" />
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.85rem' }}>Worklist · ranked by claim risk</div>
          <SuggestBadge />
        </div>
        {rows.map((r, i) => (
          <div key={r.t} style={{ display: 'flex', gap: '.6rem', padding: '11px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <span style={{ width: 6, borderRadius: 3, background: r.sev, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>{r.t}</div>
                {pill(r.bg, r.sev, r.risk)}
              </div>
              <div style={{ color: 'var(--mut)', fontSize: '.74rem', marginTop: 2 }}>{r.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimVisual() {
  const checks = [
    { ok: true, t: 'Six EVV elements captured', d: 'Service, individual, caregiver, date, location, time' },
    { ok: true, t: 'Visit inside authorized window', d: 'Auth #5520 · within date span' },
    { ok: false, t: 'Service code mismatch', d: 'Logged W1793, authorization expects W1792' },
  ];
  return (
    <div className="mk-visual">
      <Chrome url="app.rayhealthevv.com · Claim readiness" />
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>Claim #88204 · pre-check</div>
          {pill('#fdf1e3', '#b45309', '1 to review')}
        </div>
        {checks.map((c, i) => (
          <div key={c.t} style={{ display: 'flex', gap: '.55rem', alignItems: 'flex-start', padding: '11px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1, background: c.ok ? '#e7f6ec' : '#fdecec', color: c.ok ? '#16a34a' : '#b91c1c' }}>
              {c.ok ? mkic(MK_CHECK) : mkic(<path d="M18 6 6 18M6 6l12 12" />)}
            </span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>{c.t}</div>
              <div style={{ color: 'var(--mut)', fontSize: '.74rem' }}>{c.d}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: '.78rem', color: 'var(--accent-deep)', fontWeight: 600 }}>Fix code &amp; recheck — you submit when ready →</div>
      </div>
    </div>
  );
}

const visuals = [ScheduleVisual, TriageVisual, ClaimVisual];

export function AiAutomationPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Platform · AI automation</span>
          <div style={{ marginTop: 16 }}>
            <span className="mk-pill">Early access / Roadmap</span>
          </div>
          <h1 className="mk-h1">AI that drafts the work. Your team makes the call.</h1>
          <p className="mk-lead">
            RayHealth is building AI automation into the operational core — drafting schedules, triaging
            exceptions, and checking claims before they go out. We&rsquo;re honest about where it stands:
            parts are in early access, parts are on the roadmap. And every one of them is
            <strong> human-in-the-loop</strong> — RayHealth proposes, your team approves.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">See what&rsquo;s live today</Link>
            <a href="#capabilities" className="mk-btn mk-ghost">What we&rsquo;re building</a>
          </div>
        </div>
      </header>

      {/* Honest positioning band */}
      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">Where this stands</p>
          <h2 className="mk-h2">Built carefully, shipped honestly.</h2>
          <p className="mk-deck">
            Automation in home care touches money and care quality, so we roll it out deliberately and
            tell you exactly what&rsquo;s ready. Here&rsquo;s the current state of each capability.
          </p>
          <div className="mk-grid">
            {capabilities.map((c) => (
              <div className="mk-card" key={c.status}>
                <div style={{ marginBottom: 14 }}>{pill('var(--accent-tint)', 'var(--accent-deep)', c.eyebrow)}</div>
                <h3>{c.status}</h3>
                <p>{c.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dives with crafted visuals */}
      <section id="capabilities" className="mk-sec">
        <div className="mk-wrap">
          {capabilities.map((c, idx) => {
            const Visual = visuals[idx];
            return (
              <div className={`mk-feat${idx % 2 === 1 ? ' rev' : ''}`} key={c.status}>
                <div className="mk-feattext">
                  <p className="mk-eylabel">{c.eyebrow} · {c.status}</p>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                  <ul className="mk-checks">
                    {c.checks.map((ck) => (
                      <li key={ck}><span className="mk-ck">{mkic(MK_CHECK)}</span>{ck}</li>
                    ))}
                  </ul>
                </div>
                <Visual />
              </div>
            );
          })}
        </div>
      </section>

      {/* Human-in-the-loop dark section */}
      <section className="mk-sec mk-dark">
        <div className="mk-wrap">
          <div className="mk-center">
            <p className="mk-eylabel">The principle</p>
            <h2 className="mk-h2">Why human-in-the-loop, always.</h2>
            <p className="mk-deck">
              We don&rsquo;t believe an agency should hand a model the keys to its schedule, its compliance,
              or its claims. RayHealth does the heavy lifting and hands you the decision.
            </p>
          </div>
          <div className="mk-grid cols2" style={{ marginTop: 44 }}>
            {loopReasons.map((r) => (
              <div
                className="mk-card"
                key={r.t}
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--dark-line)' }}
              >
                <div className="mk-ficon" style={{ background: 'rgba(95,214,166,.14)', color: '#5fd0d6' }}>{r.i}</div>
                <h3 style={{ color: '#fff' }}>{r.t}</h3>
                <p style={{ color: '#9fa8a3' }}>{r.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">AI automation, answered straight.</h2></div>
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
            <h2>See what&rsquo;s live — and what&rsquo;s coming.</h2>
            <p>
              Book a walkthrough and we&rsquo;ll show you the automation that&rsquo;s shipped today, demo what&rsquo;s
              in early access, and be clear about what&rsquo;s still on the roadmap. No vaporware.
            </p>
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
