import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Scheduling.
 * Conflict-aware visual scheduling: a drag-and-drop weekly board that reads
 * eligibility, credentials, and authorizations in real time — so the schedule
 * a coordinator publishes is one that can actually be billed and verified.
 */

interface Pillar {
  t: string;
  b: string;
  i: React.ReactNode;
}

const pillars: Pillar[] = [
  { t: 'Drag-and-drop weekly board', b: 'Build the week visually. Move a visit and everything around it — caregiver, client, authorization, travel — recalculates as you drop it.',
    i: mkic(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>) },
  { t: 'Live eligibility & credential checks', b: 'Every assignment is checked against the caregiver’s record. Expired clearances, missing training, or service mismatches surface before the visit is published.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>) },
  { t: 'Authorization burn-down', b: 'See approved units against units scheduled and delivered. RayHealth warns before you over-schedule a client past their authorization.',
    i: mkic(<><path d="M3 3v18h18" /><path d="M19 9l-5 5-4-4-3 3" /></>) },
  { t: 'Open-shift & coverage alerts', b: 'Uncovered visits and call-outs are flagged the moment they appear, with eligible caregivers ranked so coverage is a decision, not a search.',
    i: mkic(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>) },
  { t: 'Recurring visits', b: 'Set a client’s standing schedule once. RayHealth generates the recurring visits and keeps them aligned as authorizations and availability change.',
    i: mkic(<><path d="M17 2.1 21 6l-4 3.9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 21.9 3 18l4-3.9" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>) },
  { t: 'Travel-gap detection', b: 'Back-to-back visits that can’t physically be reached are flagged, so a caregiver is never scheduled in two places at once.',
    i: mkic(<><circle cx="12" cy="10" r="3" /><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" /></>) },
];

interface Step {
  n: string;
  t: string;
  b: string;
}

const steps: Step[] = [
  { n: '01', t: 'Open the weekly board', b: 'Coordinators see every client and caregiver on one drag-and-drop grid — by day, by week, or by team.' },
  { n: '02', t: 'Drop a visit', b: 'Assign a caregiver to a slot. RayHealth checks eligibility, credentials, authorization, and travel the instant you do.' },
  { n: '03', t: 'Resolve conflicts', b: 'Anything that can’t be billed or verified is flagged inline with the reason — overlaps, expired credentials, exhausted units.' },
  { n: '04', t: 'Publish with confidence', b: 'Caregivers get the schedule on the same app they clock in with, and the visit is ready to verify and bill.' },
];

interface Stat {
  v: string;
  l: string;
}

const stats: Stat[] = [
  { v: 'Real time', l: 'Eligibility checked at the moment of assignment' },
  { v: '0', l: 'Double-booked or unreachable visits published' },
  { v: '1 board', l: 'Clients, caregivers, and authorizations in one view' },
  { v: 'Live', l: 'Open-shift and coverage alerts, as gaps appear' },
];

interface Faq {
  q: string;
  a: string;
}

const faqs: Faq[] = [
  { q: 'What conflicts does the scheduler actually catch?', a: 'Overlapping visits for the same caregiver, travel gaps that can’t be physically met, expired or missing credentials, training that’s overdue, service-type mismatches, and visits that would exceed a client’s authorized units. Each is flagged inline with the specific reason.' },
  { q: 'How does authorization burn-down work?', a: 'RayHealth tracks approved units per client against what’s already scheduled and delivered. As you build the week, it shows remaining units and warns before you publish visits that would push a client past their authorization.' },
  { q: 'Can I set up recurring and standing schedules?', a: 'Yes. Define a client’s standing pattern once and RayHealth generates the recurring visits, keeping them in step with availability and authorization changes so you’re not rebuilding the week by hand.' },
  { q: 'How does scheduling connect to EVV and workforce?', a: 'Scheduling reads the same caregiver record used for credentialing and the same authorization data used for billing. A published visit flows straight into EVV for clock-in and verification — one source of truth, not three systems to reconcile.' },
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

interface VisitCard {
  t: string;
  who: string;
  bg: string;
  bar: string;
}

interface BoardColumn {
  day: string;
  cards: VisitCard[];
}

const board: BoardColumn[] = [
  { day: 'Mon', cards: [
    { t: '8:00 AM', who: 'M. Santos', bg: '#e7f3f4', bar: '#107480' },
    { t: '1:00 PM', who: 'R. Vance', bg: '#eef3fb', bar: '#3b82f6' },
  ] },
  { day: 'Tue', cards: [
    { t: '9:30 AM', who: 'A. Brooks', bg: '#f3eefb', bar: '#8b5cf6' },
  ] },
  { day: 'Wed', cards: [
    { t: '8:00 AM', who: 'M. Santos', bg: '#e7f3f4', bar: '#107480' },
    { t: '11:00 AM', who: 'Open shift', bg: '#fdf1e3', bar: '#d97706' },
  ] },
  { day: 'Thu', cards: [
    { t: '10:00 AM', who: 'R. Vance', bg: '#eef3fb', bar: '#3b82f6' },
  ] },
  { day: 'Fri', cards: [
    { t: '8:00 AM', who: 'A. Brooks', bg: '#f3eefb', bar: '#8b5cf6' },
    { t: '2:00 PM', who: 'M. Santos', bg: '#e7f3f4', bar: '#107480' },
  ] },
];

export function SchedulingPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Solutions &middot; Scheduling</span>
          <h1 className="mk-h1">A schedule that catches conflicts before you publish them.</h1>
          <p className="mk-lead">
            RayHealth&rsquo;s scheduling is a drag-and-drop weekly board that reads eligibility, credentials, and
            authorizations as you build it. Move a visit and the platform tells you, in real time, whether it can
            actually be staffed, verified, and billed &mdash; so the week you publish is one that holds up.
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
          <p className="mk-eylabel">Conflict-aware by design</p>
          <h2 className="mk-h2">Everything a coordinator needs on one board.</h2>
          <p className="mk-deck">Scheduling stops being a spreadsheet you double-check by hand and becomes a live view that enforces the rules for you.</p>
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

      {/* How it operates */}
      <section id="how" className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">How it operates</p>
          <h2 className="mk-h2">From open board to published week.</h2>
          <p className="mk-deck">Each step checks the one before it, so a published visit is already eligible, authorized, and ready to verify.</p>
          <div className="mk-steps">
            {steps.map((s) => (
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
          {/* Weekly board visual */}
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">The weekly board</p>
              <h3>See the whole week, move one visit at a time.</h3>
              <p>Day columns, color-coded caregivers, and open shifts in plain sight. Drag a visit to a new slot and RayHealth re-checks eligibility and travel as you drop it.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Color-coded visit cards per caregiver and service</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Open shifts surfaced in-line for fast coverage</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Drag-and-drop with live re-validation on drop</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com &middot; Week of Jun 23" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                  {board.map((col) => (
                    <div key={col.day}>
                      <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'center', paddingBottom: 8 }}>{col.day}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120 }}>
                        {col.cards.map((card, i) => (
                          <div key={i} style={{ background: card.bg, borderLeft: `3px solid ${card.bar}`, borderRadius: 6, padding: '6px 7px' }}>
                            <div style={{ fontSize: '.62rem', fontWeight: 700, color: 'var(--ink)' }}>{card.t}</div>
                            <div style={{ fontSize: '.6rem', color: 'var(--ink-soft)', marginTop: 1 }}>{card.who}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Conflict detection visual */}
          <div className="mk-feat rev">
            <div className="mk-feattext">
              <p className="mk-eylabel">Conflict detection</p>
              <h3>The schedule tells you why a visit won&rsquo;t work.</h3>
              <p>Overlaps, unreachable travel, expired credentials, and exhausted authorizations are caught at the moment you assign &mdash; with the specific reason and the fix, not a silent failure later.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Double-booking and travel-gap detection</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Credential and training eligibility at assignment</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Authorization limits checked before publish</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com &middot; Assign visit" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.9rem' }}>Wed &middot; 1:00 PM &middot; J. Carter</div>
                  {pill('#fdecec', '#b91c1c', 'Conflict')}
                </div>
                <div style={{ display: 'flex', gap: '.6rem', marginTop: 12, padding: 12, background: '#fdecec', borderRadius: 10, border: '1px solid #f6d4d4' }}>
                  <span style={{ color: '#b91c1c', flexShrink: 0 }}>{mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>)}</span>
                  <div style={{ fontSize: '.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                    <strong>Travel conflict.</strong> R. Vance ends a visit 9 mi away at 1:00 PM. Earliest reachable start is 1:35 PM.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.6rem', marginTop: 10, padding: 12, background: '#fdf1e3', borderRadius: 10, border: '1px solid #f3e0c4' }}>
                  <span style={{ color: '#b45309', flexShrink: 0 }}>{mkic(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>)}</span>
                  <div style={{ fontSize: '.82rem', color: '#7c4a07', lineHeight: 1.5 }}>
                    <strong>Authorization low.</strong> Client has 3 units remaining this week.
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: '.8rem', color: 'var(--accent-deep)', fontWeight: 600 }}>Suggest an eligible caregiver &rarr;</div>
              </div>
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
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">Scheduling, answered.</h2></div>
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
            <h2>Watch the board catch a conflict live.</h2>
            <p>We&rsquo;ll load a sample week, drag a visit into an impossible slot, and show you RayHealth flag it before it&rsquo;s ever published.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/solutions/workforce-training" className="mk-btn mk-outline">Explore workforce &amp; training</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
