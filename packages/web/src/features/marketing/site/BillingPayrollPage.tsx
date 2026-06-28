import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Billing & Payroll.
 *
 * HONEST live/roadmap split — this is a Medicaid EVV product, so the page is
 * precise about what ships today versus what is being built next.
 *
 * LIVE TODAY (via the Compliance Engine):
 *   - Payroll reconciliation view  (/compliance-engine/payroll/overview)
 *   - Claim-matching / claim-status view  (/compliance-engine/claims/overview)
 *   - Exception resolution with audit trail  (/compliance-engine/exceptions)
 *   The verified-visit → reconcilable-hours → claim-status pipeline is real.
 *
 * ON THE ROADMAP (clearly labelled "Coming", NOT claimed as live):
 *   - Automated Medicaid claim generation & 837 electronic submission
 *   - Automated unit & rate validation against authorizations
 *   - Denial-risk scoring before submission
 *   - Payroll-ready file exports to payroll providers
 */

interface Feature {
  t: string;
  b: string;
  i: React.ReactNode;
}

/** What is actually live today, served by the Compliance Engine. */
const liveFeatures: readonly Feature[] = [
  {
    t: 'Payroll reconciliation view',
    b: 'Verified caregiver hours over 7-day and 30-day windows, completed visits this week, and shifts still in progress — every number derived from GPS-verified EVV visits, not hand-keyed timesheets.',
    i: mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  },
  {
    t: 'Claim-status matching',
    b: 'Every EVV visit is bucketed by status — verified, flagged, or pending — so you can see at a glance which visits are claim-ready and which still need attention before anything goes near a payer.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  },
  {
    t: 'Exception resolution',
    b: 'Open exceptions — late clock-out, GPS drift, missing data — are listed and acknowledgeable, and every action is written to a tamper-evident audit trail you can show a reviewer.',
    i: mkic(<><path d="M3 6h18M3 12h18M3 18h12" /><circle cx="19" cy="18" r="2" /></>),
  },
] as const;

/** Genuinely not built yet — labelled "Coming" everywhere it appears. */
const roadmapFeatures: readonly Feature[] = [
  {
    t: 'Automated claim generation & 837 submission',
    b: 'Assemble claim-ready visits into payer claims and submit them electronically (837) — instead of exporting status and building claims in another system.',
    i: mkic(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>),
  },
  {
    t: 'Unit & rate validation',
    b: 'Check authorized units, service codes, and contracted rates against the authorization automatically — catching over-billed units and wrong rates before submission.',
    i: mkic(<><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /><path d="M9 11l2 2 4-4" /></>),
  },
  {
    t: 'Denial-risk scoring',
    b: 'Score each claim line for denial risk before submission — surfacing the patterns that get claims rejected (missing EVV, lapsed authorization, mismatched payer detail) up front.',
    i: mkic(<><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>),
  },
  {
    t: 'Payroll-ready exports',
    b: 'Turn the same verified hours into clean export files for the payroll provider you already use — visit time, mileage, and pay rules totaled per caregiver, per period.',
    i: mkic(<><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  },
] as const;

interface PipelineStep {
  n: string;
  t: string;
  b: string;
  live: boolean;
}

/** verified visit → reconcilable hours → claim status → [coming] generated claim */
const pipeline: readonly PipelineStep[] = [
  { n: '01', t: 'Verified visit', b: 'A caregiver clocks in and out with GPS-verified EVV; tasks and time are captured against the authorization.', live: true },
  { n: '02', t: 'Reconcilable hours', b: 'Verified visits roll up into payroll reconciliation — verified hours over 7- and 30-day windows, completed and in-progress shifts.', live: true },
  { n: '03', t: 'Claim status', b: 'Each visit is bucketed verified, flagged, or pending, and open exceptions are resolved against the audit trail.', live: true },
  { n: '04', t: 'Generated claim', b: 'Coming: claim-ready visits are validated against the authorization, scored for denial risk, and submitted via 837.', live: false },
] as const;

const faqs = [
  {
    q: 'What is actually live in billing & payroll today?',
    a: 'Three things, all served by RayHealth’s live Compliance Engine: a payroll reconciliation view (verified caregiver hours over 7- and 30-day windows, plus completed and in-progress shifts), a claim-status view that buckets every EVV visit as verified, flagged, or pending, and exception resolution with an audit trail. All of it is derived from GPS-verified EVV visits — the verified-visit → reconcilable-hours → claim-status pipeline is real and running.',
  },
  {
    q: 'What is still on the roadmap — not live yet?',
    a: 'Four capabilities are in development and not shipped: automated Medicaid claim generation and 837 electronic submission to payers, automated unit & rate validation against authorizations, denial-risk scoring before submission, and payroll-ready file exports to your payroll provider. We label these "Coming" everywhere on this page and we will not describe them as live until they ship.',
  },
  {
    q: 'What is the timeline for automated claim generation and exports?',
    a: 'We are building incrementally on top of the live reconciliation and claim-status foundation, starting with unit & rate validation and claim generation, then 837 submission and payroll exports. Exact dates depend on agency-partner feedback, so we are not putting a hard ship date on this page — if you want to influence what we ship first, talk to us in a demo.',
  },
  {
    q: 'Will RayHealth replace my clearinghouse or payroll provider?',
    a: 'No. The foundation is that a claim line should only exist behind a GPS-verified visit. Today RayHealth verifies visits, reconciles hours, and shows claim status; the roadmap work hands clean, validated data to the clearinghouse and payroll systems you already use. RayHealth is the verification and reconciliation layer, not your check-cutter.',
  },
] as const;

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

interface StatusRow {
  n: string;
  d: string;
  s: string;
  c: string;
  bg: string;
}

/** Claim-status panel — brand tokens only: teal (verified), orange (flagged), neutral (pending). */
const statusRows: readonly StatusRow[] = [
  { n: 'M. Santos · PCA · Mon 9:02–11:58', d: 'GPS-verified · within geofence', s: 'Verified', c: 'var(--accent-deep)', bg: 'var(--accent-tint)' },
  { n: 'A. Brooks · PCA · Mon 13:10–16:20', d: 'Late clock-out — exception open', s: 'Flagged', c: 'var(--accent2-deep)', bg: 'var(--accent2-tint)' },
  { n: 'R. Vance · Respite · Tue 08:00–10:00', d: 'Awaiting caregiver sync', s: 'Pending', c: 'var(--mut)', bg: 'var(--surface)' },
  { n: 'D. Okafor · PCA · Tue 10:30–13:30', d: 'GPS-verified · within geofence', s: 'Verified', c: 'var(--accent-deep)', bg: 'var(--accent-tint)' },
] as const;

export function BillingPayrollPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Solutions · Billing &amp; payroll</span>
          <h1 className="mk-h1">Verified visits, reconciled hours, clear claim status.</h1>
          <p className="mk-lead">
            Reconciliation and claim-status views are live today, built on RayHealth&rsquo;s Compliance Engine: a claim
            line should only exist behind a GPS-verified visit. Full automated claim generation, 837 submission, and
            payroll export are the next module we&rsquo;re building &mdash; and we&rsquo;ll be straight about which is which.
          </p>
          <div className="mk-herocta">
            <span className="mk-pill">Reconciliation live · claim generation coming</span>
          </div>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">See it on your caseload</Link>
            <Link to="/platform/compliance" className="mk-btn mk-ghost">Explore the Compliance Engine</Link>
          </div>
        </div>
      </header>

      {/* What's live today */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">Live today</p>
          <h2 className="mk-h2">What&rsquo;s running right now.</h2>
          <p className="mk-deck">
            Three views ship today through the live Compliance Engine, every figure derived from GPS-verified EVV
            visits &mdash; not hand-keyed timesheets.
          </p>
          <div className="mk-grid">
            {liveFeatures.map((c) => (
              <div className="mk-card" key={c.t}>
                <div className="mk-ficon">{c.i}</div>
                <h3>{c.t}</h3>
                <p>{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dive: live claim-status panel + verified-hours summary */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">Claim status · live</p>
              <h3>Every visit, bucketed claim-ready or not.</h3>
              <p>
                The claim-matching view sorts each EVV visit into verified, flagged, or pending &mdash; so billers can
                see which visits are claim-ready and which need attention before submission. This view is live in
                RayHealth today.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Verified &mdash; GPS-confirmed visit, claim-ready</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Flagged &mdash; an exception is open and tracked</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Pending &mdash; awaiting visit data or caregiver sync</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com · Claims overview" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 4, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>Visits · Jun 16–22</div>
                  {pill('var(--accent-tint)', 'var(--accent-deep)', 'Live')}
                </div>
                {statusRows.map((r, i) => (
                  <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.6rem', padding: '11px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div><div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>{r.n}</div><div style={{ color: 'var(--mut)', fontSize: '.72rem' }}>{r.d}</div></div>
                    {pill(r.bg, r.c, r.s)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mk-feat rev">
            <div className="mk-feattext">
              <p className="mk-eylabel">Payroll reconciliation · live</p>
              <h3>Verified hours, reconciled from the visit record.</h3>
              <p>
                The reconciliation view totals verified caregiver hours over 7- and 30-day windows, plus completed
                visits this week and shifts still in progress &mdash; all from GPS-verified EVV visits, so billing and
                pay read from one source of truth. This view is live today.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Verified hours across 7-day and 30-day windows</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Completed visits this week and in-progress shifts</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Every hour traces to a GPS-verified EVV visit</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com · Payroll overview" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                {[
                  { l: 'Verified hours · last 7 days', v: '312.5 hrs' },
                  { l: 'Verified hours · last 30 days', v: '1,284 hrs' },
                  { l: 'Completed visits · this week', v: '146' },
                  { l: 'Shifts in progress', v: '9' },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontSize: '.85rem', color: 'var(--ink-soft)' }}>{r.l}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.9rem', fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, display: 'flex', gap: '.6rem', alignItems: 'center', padding: 12, background: 'var(--accent-tint)', borderRadius: 10 }}>
                  <span style={{ color: 'var(--accent-deep)', flexShrink: 0 }}>{mkic(MK_CHECK)}</span>
                  <div style={{ fontSize: '.82rem', color: 'var(--accent-deep)', lineHeight: 1.5, fontWeight: 600 }}>Every reconciled hour traces to a verified EVV visit.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* On the roadmap — clearly separated */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap' }}>
            <p className="mk-eylabel" style={{ margin: 0 }}>On the roadmap</p>
            <span className="mk-pill">Coming</span>
          </div>
          <h2 className="mk-h2">What we&rsquo;re building next.</h2>
          <p className="mk-deck">
            These four capabilities are in active development &mdash; not live yet. They extend the verified-visit
            foundation into full claim generation and payroll export. We won&rsquo;t call them shipped until they are.
          </p>
          <div className="mk-grid cols2">
            {roadmapFeatures.map((c) => (
              <div className="mk-card" key={c.t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.6rem' }}>
                  <div className="mk-ficon">{c.i}</div>
                  {pill('var(--accent2-tint)', 'var(--accent2-deep)', 'Coming')}
                </div>
                <h3>{c.t}</h3>
                <p>{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline: verified visit → reconcilable hours → claim status → [coming] generated claim */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">The pipeline</p>
          <h2 className="mk-h2">From verified visit to a claim you can defend.</h2>
          <p className="mk-deck">Steps 01–03 are live today. Step 04 is the claim-generation module we&rsquo;re building on top of them.</p>
          <div className="mk-steps">
            {pipeline.map((s) => (
              <div className="mk-step" key={s.n} style={s.live ? undefined : { borderTopColor: 'var(--accent2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                  <div className="sn">{s.n}</div>
                  {s.live
                    ? pill('var(--accent-tint)', 'var(--accent-deep)', 'Live')
                    : pill('var(--accent2-tint)', 'var(--accent2-deep)', 'Coming')}
                </div>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">Billing &amp; payroll, honestly.</h2></div>
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
            <h2>See reconciliation live &mdash; and shape what ships next.</h2>
            <p>The verified-visit foundation, payroll reconciliation, and claim status are live today. Early agency partners help decide which roadmap capability we build first.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/platform/compliance" className="mk-btn mk-outline">Explore the Compliance Engine</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
