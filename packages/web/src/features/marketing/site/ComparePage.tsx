import { Link } from 'react-router-dom';
import { SiteLayout, mkic } from './SiteLayout.js';

/**
 * Company › Compare: RayHealth vs. the old way.
 * A category comparison — spreadsheets + payer portals on one side, legacy
 * enterprise agency platforms on the other. Deliberately names no vendor:
 * the argument is against ways of working, not against a company.
 */

interface CompareRow {
  capability: string;
  spreadsheets: string;
  legacy: string;
  rayhealth: string;
}

const ROWS: CompareRow[] = [
  {
    capability: 'EVV capture',
    spreadsheets: 'Manual entry in the payer portal, after the fact',
    legacy: 'Supported, often as a bolted-on module',
    rayhealth: 'Native: GPS-verified clock-in/out, offline-safe, exceptions engine',
  },
  {
    capability: 'Missed or offline visits',
    spreadsheets: 'Reconstructed from memory at week end',
    legacy: 'Manual corrections queue',
    rayhealth: 'Encrypted offline queue replays punches with original capture times',
  },
  {
    capability: 'Claims',
    spreadsheets: 'Typed into the portal, claim by claim',
    legacy: 'Batch generation, scrubbing varies',
    rayhealth: '837P generated from verified visits, validated before submission',
  },
  {
    capability: 'Remittances (835)',
    spreadsheets: 'PDFs downloaded and reconciled by hand',
    legacy: 'Posting supported, denial detail often thin',
    rayhealth: 'Auto-posted against claims with CARC/RARC reason codes',
  },
  {
    capability: 'Denials',
    spreadsheets: 'Discovered when the payment is short',
    legacy: 'A report you have to remember to run',
    rayhealth: 'Flagged with reasons and tracked to resolution',
  },
  {
    capability: 'Scheduling conflicts',
    spreadsheets: 'Caught by whoever notices',
    legacy: 'Warnings, sometimes ignorable by default',
    rayhealth: 'Conflict gate at assignment time, before the visit exists',
  },
  {
    capability: 'Caregiver credentials',
    spreadsheets: 'A spreadsheet tab someone owns',
    legacy: 'Tracked, expiry alerts vary',
    rayhealth: 'Tracked with expirations wired into assignment eligibility',
  },
  {
    capability: 'Audit preparation',
    spreadsheets: 'A stressful week of assembling folders',
    legacy: 'Reports exist, assembly is still yours',
    rayhealth: 'Audit packet generated from tamper-evident records on demand',
  },
  {
    capability: 'Visit documentation',
    spreadsheets: 'Paper notes, sometimes transcribed',
    legacy: 'Free-text box',
    rayhealth: 'Task checklist + note at clock-out, with AI polish the caregiver reviews',
  },
  {
    capability: 'Contracts',
    spreadsheets: 'Free, and worth it',
    legacy: 'Annual contracts, per-seat pricing common',
    rayhealth: 'Month-to-month, no per-seat licenses',
  },
];

const WHY_CARDS = [
  {
    title: 'Built for the visit, not the back office',
    body: 'Everything downstream — claims, payroll, audits — is generated from the verified visit record, so the back office stops re-keying what the field already proved.',
    icon: mkic(
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>,
    ),
  },
  {
    title: 'Honest about what software can promise',
    body: 'No platform makes an audit disappear. What RayHealth promises is that the record you need is captured at the moment of care and retrievable in seconds.',
    icon: mkic(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </>,
    ),
  },
  {
    title: 'Sized for real agencies',
    body: 'RayHealth is built for the agency running dozens of caregivers — not a downsized enterprise suite with modules you will never open.',
    icon: mkic(
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </>,
    ),
  },
];

export function ComparePage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Compare</span>
          <h1 className="mk-h1">RayHealth vs. the old way.</h1>
          <p className="mk-lead">
            Most agencies run on one of two things: spreadsheets plus the payer portal, or a
            legacy platform bought years ago. Here is the honest comparison — capability by
            capability, no vendor bashing.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">See it on your data</Link>
            <Link to="/switch" className="mk-btn mk-ghost">How switching works</Link>
          </div>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <span className="mk-eylabel">Capability by capability</span>
          <h2 className="mk-h2">Where the day actually goes.</h2>
          <p className="mk-deck">
            The difference is not features on a list — it is whether each capability feeds the
            next one, or leaves a human to carry data between them.
          </p>
          <div style={{ marginTop: '36px', overflowX: 'auto' }}>
            <table className="mk-tbl">
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  <th scope="col">Spreadsheets + payer portal</th>
                  <th scope="col">Legacy agency platforms</th>
                  <th scope="col">RayHealth</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.capability}>
                    <td>{r.capability}</td>
                    <td>{r.spreadsheets}</td>
                    <td>{r.legacy}</td>
                    <td>{r.rayhealth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <span className="mk-eylabel">Why it holds up</span>
          <h2 className="mk-h2">One operational core, not ten tabs.</h2>
          <div className="mk-grid">
            {WHY_CARDS.map((c) => (
              <div className="mk-card" key={c.title}>
                <div className="mk-ficon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>The fair test: your data, side by side.</h2>
            <p>
              Bring one week of real visits and run them through RayHealth in parallel with your
              current process. If it does not win the comparison, keep what you have.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/switch" className="mk-btn mk-outline">Read the switching guide</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
