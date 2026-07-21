import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Company › Switching to RayHealth.
 * The migration promise page: what moves, who does the work, and how long it
 * takes. Deliberately names no competitor — it speaks to the category
 * (spreadsheets, payer portals, legacy agency platforms) and to the fear of
 * switching, which is the real objection.
 */

interface MigrationStep {
  n: string;
  title: string;
  body: string;
}

const STEPS: MigrationStep[] = [
  {
    n: '01',
    title: 'Export what you have',
    body: 'CSV exports from your current system, or the spreadsheets you already run on. No special format required — we work from what exists.',
  },
  {
    n: '02',
    title: 'We map and import',
    body: 'Clients, caregivers, and service authorizations are mapped into RayHealth by our team and verified against your source files, row by row.',
  },
  {
    n: '03',
    title: 'Run a parallel week',
    body: 'Your caregivers clock real visits in RayHealth while your old process keeps running. You compare outputs before anything depends on us.',
  },
  {
    n: '04',
    title: 'Cut over clean',
    body: 'EVV submissions and claims continue without a gap. Your old exports stay archived in RayHealth for audit continuity.',
  },
];

const MOVES_WITH_YOU: string[] = [
  'Clients, contacts, and addresses (geofence anchors set on import)',
  'Caregivers, credentials, and expiration dates',
  'Service authorizations with units, rates, and date spans',
  'Schedules and standing visit patterns',
  'Historical records you want retrievable at audit time',
];

const CONTINUITY = [
  {
    title: 'Billing never pauses',
    body: 'Claims for visits before, during, and after the switch are generated and tracked in one place, so the cutover week is not a revenue hole.',
    icon: mkic(
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>,
    ),
  },
  {
    title: 'EVV never pauses',
    body: 'Aggregator submission is configured and verified during the parallel week, before your old process stops, not after.',
    icon: mkic(
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>,
    ),
  },
  {
    title: 'Your team is trained by launch',
    body: 'Coordinators and caregivers train on your real data during the parallel week — not on a demo agency they will never see again.',
    icon: mkic(
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>,
    ),
  },
];

const FAQS = [
  {
    q: 'How long does switching actually take?',
    a: 'For most agencies the timeline is one week: import and verification in the first days, a parallel run on live visits, then cutover. Larger books of business extend the parallel run, not the import.',
  },
  {
    q: 'Do we have to retype our records?',
    a: 'No. Client, caregiver, and authorization records are imported from CSV exports or spreadsheets by our team. You review and approve the imported data — you do not re-enter it.',
  },
  {
    q: 'What if we are coming from paper?',
    a: 'Then the import step is lighter, not harder. We set up your clients and caregivers from whatever roster you have, and your first EVV-verified visits become your first clean records.',
  },
  {
    q: 'Are we locked into a contract?',
    a: 'No. RayHealth is month-to-month. The switching work we do for you is not a hostage — your data is exportable at any time.',
  },
];

export function SwitchPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Switching to RayHealth</span>
          <h1 className="mk-h1">Switch without the scary part.</h1>
          <p className="mk-lead">
            The reason agencies stay on software they dislike is the migration, not the product.
            So we do the migration for you: your data moves, your team gets trained, and EVV and
            billing continue without a gap. Most agencies are live in under a week.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">Book a migration call</Link>
            <Link to="/compare" className="mk-btn mk-ghost">Compare the old way</Link>
          </div>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <span className="mk-eylabel">How it works</span>
          <h2 className="mk-h2">Four steps, and we do the heavy two.</h2>
          <p className="mk-deck">
            You export and approve. We map, import, verify, and train. Nothing cuts over until
            you have watched a real week of visits flow through RayHealth correctly.
          </p>
          <div className="mk-steps">
            {STEPS.map((s) => (
              <div className="mk-step" key={s.n}>
                <span className="sn">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-feat">
            <div className="mk-feattext">
              <span className="mk-eylabel">What moves with you</span>
              <h3>Your operating history, not just your roster.</h3>
              <p>
                A switch that only moves names and phone numbers leaves your compliance story
                behind. RayHealth imports the records an auditor will actually ask about.
              </p>
              <ul className="mk-checks">
                {MOVES_WITH_YOU.map((item) => (
                  <li key={item}>
                    <span className="mk-ck">{mkic(MK_CHECK)}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mk-visual" aria-hidden>
              <div style={{ padding: '18px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.8rem', lineHeight: 2, color: '#39433e' }}>
                <div>clients.csv <span style={{ color: '#107480' }}>→ 84 imported · 84 verified</span></div>
                <div>caregivers.csv <span style={{ color: '#107480' }}>→ 31 imported · 31 verified</span></div>
                <div>authorizations.csv <span style={{ color: '#107480' }}>→ 112 imported · units reconciled</span></div>
                <div style={{ color: '#8a948e' }}>parallel week · day 5 of 5</div>
                <div style={{ color: '#0c5d66', fontWeight: 600 }}>✓ ready to cut over</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <div className="mk-wrap">
          <span className="mk-eylabel">Continuity</span>
          <h2 className="mk-h2">Nothing stops while you switch.</h2>
          <div className="mk-grid">
            {CONTINUITY.map((c) => (
              <div className="mk-card" key={c.title}>
                <div className="mk-ficon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec mk-alt tight">
        <div className="mk-wrap">
          <div className="mk-center">
            <span className="mk-eylabel">Questions agencies ask</span>
            <h2 className="mk-h2">Switching, honestly answered.</h2>
          </div>
          <div className="mk-faqs">
            {FAQS.map((f) => (
              <div className="mk-faq" key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Bring us your spreadsheet. Keep your week.</h2>
            <p>
              Book a migration call and we will look at your current setup together — what moves,
              what it costs, and exactly what your first week looks like.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a migration call</Link>
              <Link to="/contact" className="mk-btn mk-outline">Talk to us first</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
