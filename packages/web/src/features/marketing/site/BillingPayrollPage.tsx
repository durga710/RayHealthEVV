import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Billing & Payroll.
 *
 * HONEST live/roadmap split, this is a Medicaid EVV product, so the page is
 * precise about what ships today versus what depends on external credentials.
 *
 * LIVE TODAY:
 *   - Claim generation from GPS-verified visits (grouped by client + payer)
 *   - Unit & authorization validation (remaining authorized units, service
 *     code, date window), billed units never silently exceed the authorization
 *   - Denial-risk scoring before submission
 *   - X12 837P (005010X222A1) export
 *   - Payroll CSV export (verified hours per caregiver, per period)
 *   - Payroll reconciliation, claim-status + exception views (Compliance Engine)
 *
 * REMAINING, labelled honestly, mostly external dependencies, NOT claimed live:
 *   - Automated direct transmission to a clearinghouse (needs the agency's
 *     trading-partner account; the 837 file is generated today)
 *   - Contracted fee schedule so claims carry dollar amounts (units are
 *     validated today; charges are $0.00 until a fee schedule is loaded)
 *   - Direct payroll-provider integrations (ADP/Paychex/Gusto). CSV is live
 */

interface Feature {
  t: string;
  b: string;
  i: React.ReactNode;
}

/** What is actually live today. */
const liveFeatures: readonly Feature[] = [
  {
    t: 'Claim generation from verified visits',
    b: 'Assemble GPS-verified EVV visits into Medicaid claims, grouped by client and payer. Every claim line is backed by one immutable verified visit, a claim line never exists without a clocked, geofence-validated visit behind it.',
    i: mkic(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>),
  },
  {
    t: 'Unit & authorization validation',
    b: 'Each line is validated against the client’s authorization, service code, date window, and remaining authorized units. Billed units never silently exceed what was authorized; over-cap and lapsed-auth lines are flagged before anything is submitted.',
    i: mkic(<><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /><path d="M9 11l2 2 4-4" /></>),
  },
  {
    t: 'Denial-risk scoring',
    b: 'Every line is scored low / medium / high before submission, surfacing the patterns that get claims denied, unverified EVV, missing Medicaid id or NPI, aggregator rejection, units over the authorization, with the specific reason on each line.',
    i: mkic(<><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>),
  },
  {
    t: 'X12 837P export',
    b: 'Generate a standards-compliant 837P (005010X222A1) for any claim, the same Health Care Claim: Professional file your clearinghouse and PA PROMISe accept. Download it and upload to your clearinghouse portal today.',
    i: mkic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>),
  },
  {
    t: 'Payroll CSV export',
    b: 'Turn the same verified hours into a payroll-ready CSV, visit time totaled per caregiver, per period, to import into the payroll provider you already use. Unverified and incomplete visits are excluded automatically.',
    i: mkic(<><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  },
  {
    t: 'Claim status & exceptions',
    b: 'Track each claim through draft → ready → submitted → paid, and resolve open exceptions against a tamper-evident audit trail. Reconciliation and claim-status views give billers one source of truth from the visit record.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  },
] as const;

/** Genuinely not done in-product, mostly external dependencies. Labelled "Coming". */
const roadmapFeatures: readonly Feature[] = [
  {
    t: 'Automated clearinghouse transmission',
    b: 'The 837P file is generated today; one-click direct submission plugs into your clearinghouse trading-partner account (an external credential only your agency can provision). Until it’s connected, you download the 837 and upload it to your clearinghouse portal, a real, supported workflow.',
    i: mkic(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>),
  },
  {
    t: 'Contracted fee schedule',
    b: 'Load your per-code, per-payer rates so generated claims carry dollar amounts. Today units are computed and validated against the authorization; charges are $0.00 until a fee schedule is loaded, and we flag that before you submit, never silently.',
    i: mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H9" /></>),
  },
  {
    t: 'Direct payroll-provider integrations',
    b: 'Push verified hours straight into ADP, Paychex, or Gusto. The payroll CSV export is live today; native push connectors are the next step on top of it.',
    i: mkic(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>),
  },
] as const;

interface PipelineStep {
  n: string;
  t: string;
  b: string;
  live: boolean;
}

/** verified visit → hours → claim status → generated claim (live) → transmitted (external) */
const pipeline: readonly PipelineStep[] = [
  { n: '01', t: 'Verified visit', b: 'A caregiver clocks in and out with GPS-verified EVV; tasks and time are captured against the authorization.', live: true },
  { n: '02', t: 'Reconcilable hours', b: 'Verified visits roll up into payroll reconciliation and a payroll-ready CSV export, per caregiver, per period.', live: true },
  { n: '03', t: 'Validated claim', b: 'Claim-ready visits are assembled into claims, each line validated against the authorization and scored for denial risk.', live: true },
  { n: '04', t: '837P generated', b: 'A standards-compliant 837P (005010X222A1) is generated for the claim, ready to submit.', live: true },
  { n: '05', t: 'Transmitted', b: 'Direct one-click submission to the payer plugs into your clearinghouse trading-partner account, the one external step we’re wiring next.', live: false },
] as const;

const faqs = [
  {
    q: 'What is actually live in billing & payroll today?',
    a: 'A lot: claim generation from GPS-verified visits, unit & authorization validation (billed units never exceed the authorization), denial-risk scoring on every line, X12 837P export, and payroll CSV export, plus the reconciliation, claim-status, and exception views in the live Compliance Engine. All of it is derived from GPS-verified EVV visits.',
  },
  {
    q: 'Can RayHealth submit claims directly to the payer?',
    a: 'RayHealth generates the 837P file today. Direct electronic transmission plugs into your clearinghouse trading-partner account, an external credential only your agency can provision. Until that connector is enabled, you download the generated 837 and upload it to your clearinghouse portal, which is a standard, supported workflow. We label automated transmission "coming" and won’t claim it as live until it ships.',
  },
  {
    q: 'Do generated claims include dollar amounts?',
    a: 'Units are computed from verified visit time and validated against the authorization today. Dollar charges populate once you load your contracted fee schedule; until then the 837 carries validated units with $0.00 charges, and we surface that before you submit, so nothing goes out priced incorrectly by surprise.',
  },
  {
    q: 'Will RayHealth replace my clearinghouse or payroll provider?',
    a: 'No. A claim line should only exist behind a GPS-verified visit, that’s the foundation. RayHealth is the verification, claim-assembly, and payroll-prep layer: it hands clean, validated 837s and payroll CSVs to the clearinghouse and payroll systems you already use. It is not your check-cutter.',
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

/** Claim-status panel, brand tokens only: teal (verified), orange (flagged), neutral (pending). */
const statusRows: readonly StatusRow[] = [
  { n: 'M. Santos · PCA · Mon 9:02-11:58', d: 'GPS-verified · within geofence', s: 'Verified', c: 'var(--accent-deep)', bg: 'var(--accent-tint)' },
  { n: 'A. Brooks · PCA · Mon 13:10-16:20', d: 'Late clock-out, exception open', s: 'Flagged', c: 'var(--accent2-deep)', bg: 'var(--accent2-tint)' },
  { n: 'R. Vance · Respite · Tue 08:00-10:00', d: 'Awaiting caregiver sync', s: 'Pending', c: 'var(--mut)', bg: 'var(--surface)' },
  { n: 'D. Okafor · PCA · Tue 10:30-13:30', d: 'GPS-verified · within geofence', s: 'Verified', c: 'var(--accent-deep)', bg: 'var(--accent-tint)' },
] as const;

export function BillingPayrollPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Solutions · Billing &amp; payroll</span>
          <h1 className="mk-h1">From a verified visit to a Medicaid claim you can defend.</h1>
          <p className="mk-lead">
            Generate Medicaid claims from GPS-verified visits, validate every line against the authorization, score
            denial risk, and export the 837P and payroll CSV &mdash; all live today. The one remaining step, automated
            transmission, plugs into your clearinghouse account, and we&rsquo;ll be straight about which is which.
          </p>
          <div className="mk-herocta">
            <span className="mk-pill">Claim generation · 837P · denial scoring · payroll export, live</span>
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
            Claim generation, authorization validation, denial scoring, 837P export, and payroll export all ship
            today &mdash; every figure derived from GPS-verified EVV visits, not hand-keyed timesheets.
          </p>
          <div className="mk-grid cols2">
            {liveFeatures.map((c) => (
              <div className="mk-card" key={c.t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.6rem' }}>
                  <div className="mk-ficon">{c.i}</div>
                  {pill('var(--accent-tint)', 'var(--accent-deep)', 'Live')}
                </div>
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
                  <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>Visits · Jun 16-22</div>
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
              <p className="mk-eylabel">Payroll &amp; export · live</p>
              <h3>Verified hours, reconciled and exportable.</h3>
              <p>
                The reconciliation view totals verified caregiver hours over 7- and 30-day windows, and a one-click
                CSV export turns the same verified hours into a payroll-ready file per caregiver, per period &mdash;
                all from GPS-verified EVV visits, so billing and pay read from one source of truth.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Verified hours across 7-day and 30-day windows</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Payroll-ready CSV export, per caregiver, per period</li>
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

      {/* On the roadmap, clearly separated */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap' }}>
            <p className="mk-eylabel" style={{ margin: 0 }}>What&rsquo;s next</p>
            <span className="mk-pill">Coming</span>
          </div>
          <h2 className="mk-h2">The remaining steps, mostly your credentials, not our code.</h2>
          <p className="mk-deck">
            Generation, validation, scoring, and export are done. What&rsquo;s left is largely external: connecting
            your clearinghouse and loading your fee schedule. We won&rsquo;t call these shipped until they are.
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

      {/* Pipeline */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">The pipeline</p>
          <h2 className="mk-h2">From verified visit to a claim you can defend.</h2>
          <p className="mk-deck">Steps 01-04 are live today. Step 05, automated transmission, plugs into your clearinghouse account.</p>
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
            <h2>See claim generation live &mdash; on your own caseload.</h2>
            <p>Verified-visit claim generation, denial scoring, 837P, and payroll export are live today. Book a demo and we&rsquo;ll run it against a real pay period with you.</p>
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
