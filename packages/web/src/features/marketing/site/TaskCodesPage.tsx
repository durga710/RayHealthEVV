import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Resources › Reference: Pennsylvania DHS task codes (the 106–256 range).
 *
 * INTEGRITY NOTE: This page does NOT reproduce the official PA DHS / OLTL
 * code list. The numbers shown are illustrative examples to communicate how
 * task codes group into categories. The authoritative, current code set ships
 * inside the RayHealth product and must be confirmed against current PA DHS /
 * OLTL bulletins. Disclaimers are rendered prominently near the top and again
 * directly above every table.
 */

interface TaskRow {
  code: string;
  task: string;
  category: string;
}

interface TaskGroup {
  category: string;
  blurb: string;
  rows: TaskRow[];
}

const groups: TaskGroup[] = [
  {
    category: 'Personal care',
    blurb: 'Hands-on assistance with activities of daily living (ADLs) — the core of most personal-assistance plans.',
    rows: [
      { code: 'e.g. 1xx', task: 'Bathing / personal hygiene', category: 'Personal care' },
      { code: 'e.g. 1xx', task: 'Dressing', category: 'Personal care' },
      { code: 'e.g. 1xx', task: 'Grooming (hair, shaving, oral care)', category: 'Personal care' },
      { code: 'e.g. 1xx', task: 'Toileting & incontinence care', category: 'Personal care' },
      { code: 'e.g. 1xx', task: 'Mobility & ambulation assistance', category: 'Personal care' },
      { code: 'e.g. 1xx', task: 'Transfers (bed, chair, wheelchair)', category: 'Personal care' },
      { code: 'e.g. 1xx', task: 'Eating / feeding assistance', category: 'Personal care' },
    ],
  },
  {
    category: 'Household / IADL',
    blurb: 'Instrumental activities of daily living (IADLs) — support that keeps a consumer safe and independent at home.',
    rows: [
      { code: 'e.g. 2xx', task: 'Meal preparation', category: 'Household / IADL' },
      { code: 'e.g. 2xx', task: 'Light housekeeping', category: 'Household / IADL' },
      { code: 'e.g. 2xx', task: 'Laundry', category: 'Household / IADL' },
      { code: 'e.g. 2xx', task: 'Shopping & errands', category: 'Household / IADL' },
      { code: 'e.g. 2xx', task: 'Escort / accompaniment to appointments', category: 'Household / IADL' },
    ],
  },
  {
    category: 'Health-related',
    blurb: 'Skilled-adjacent and health-supportive tasks that often require specific authorization and documentation.',
    rows: [
      { code: 'e.g. 2xx', task: 'Medication reminders', category: 'Health-related' },
      { code: 'e.g. 2xx', task: 'Vital signs (where authorized)', category: 'Health-related' },
      { code: 'e.g. 2xx', task: 'Range-of-motion exercises', category: 'Health-related' },
      { code: 'e.g. 2xx', task: 'Skin / pressure-area monitoring', category: 'Health-related' },
    ],
  },
];

const Disclaimer = ({ compact = false }: { compact?: boolean }) => (
  <div
    style={{
      display: 'flex',
      gap: '.7rem',
      padding: compact ? '14px 16px' : '18px 20px',
      background: '#fdf8ee',
      border: '1px solid #f0e2c4',
      borderRadius: 14,
      marginTop: compact ? 24 : 28,
    }}
  >
    <span style={{ color: '#b45309', flexShrink: 0 }}>
      {mkic(
        <>
          <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </>,
      )}
    </span>
    <div style={{ fontSize: compact ? '.85rem' : '.92rem', color: '#7c5410', lineHeight: 1.55 }}>
      <strong style={{ color: '#5f3e08' }}>Representative reference only.</strong>{' '}
      Confirm exact codes and descriptions against current PA DHS / OLTL bulletins. The numbers below
      are <em>illustrative examples</em>, not official code assignments. RayHealth ships the current,
      authoritative code set in-product and updates it as the state publishes changes.
    </div>
  </div>
);

export function TaskCodesPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Resources · Reference</span>
          <h1 className="mk-h1">Pennsylvania DHS task codes, explained.</h1>
          <p className="mk-lead">
            A plain-language reference to the personal-assistance and home-health task codes
            (roughly the <strong>106&ndash;256</strong> range) that coordinators place on PA care
            plans &mdash; and how RayHealth wires them into care plans and visit templates.
          </p>
          <div className="mk-herocta">
            <span className="mk-pill">Reference</span>
          </div>
        </div>
      </header>

      {/* Intro + top-level disclaimer */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-prose">
            <p className="lead">
              Pennsylvania&rsquo;s Department of Human Services (DHS), through the Office of
              Long-Term Living (OLTL), uses <strong>task codes</strong> to standardize the duties a
              caregiver performs on a personal-assistance or home-health visit. Each code maps to a
              specific task &mdash; bathing, meal prep, a medication reminder &mdash; so the duty is
              described the same way on the care plan, the schedule, and the claim.
            </p>
            <p>
              In RayHealth, task codes are the connective tissue between authorization and delivery.
              A consumer&rsquo;s authorized tasks become a <strong>care plan</strong>; that care plan
              becomes a <strong>visit template</strong> the caregiver sees at clock-in; and the tasks
              completed on the visit flow back into the verified record and the claim. Because the
              codes are shared across all three, what was authorized, what was scheduled, and what was
              billed stay aligned.
            </p>

            <Disclaimer />

            <h2>How task codes are used in RayHealth</h2>
            <ul>
              <li>
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span>
                  <strong>Care plans:</strong> coordinators add the authorized task codes to a
                  consumer&rsquo;s plan, with frequency and any per-task notes.
                </span>
              </li>
              <li>
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span>
                  <strong>Visit templates:</strong> the plan&rsquo;s codes pre-populate each
                  scheduled visit, so the caregiver knows exactly which tasks to complete and confirm.
                </span>
              </li>
              <li>
                <span className="mk-ck">{mkic(MK_CHECK)}</span>
                <span>
                  <strong>Verification &amp; claims:</strong> completed task codes are captured at the
                  visit and carried into the EVV record and the claim, keeping authorization and
                  delivery in lockstep.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Representative tables */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">Representative reference</p>
          <h2 className="mk-h2">Task categories at a glance.</h2>
          <p className="mk-deck">
            The 106&ndash;256 range groups into a handful of practical categories. Below is a
            representative set of tasks per category &mdash; useful for orientation, not as the
            official code list.
          </p>

          <Disclaimer compact />

          {groups.map((g) => (
            <div key={g.category} style={{ marginTop: 8 }}>
              <h3 style={{ marginTop: 40, fontSize: '1.15rem', letterSpacing: '-.01em' }}>
                {g.category}
              </h3>
              <p style={{ marginTop: 8, fontSize: '.97rem', lineHeight: 1.6, color: 'var(--body)', maxWidth: '60ch' }}>
                {g.blurb}
              </p>
              <table className="mk-tbl" style={{ marginTop: 18 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '20%' }}>Code</th>
                    <th scope="col" style={{ width: '49%' }}>Task</th>
                    <th scope="col" style={{ width: '31%' }}>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.task}>
                      <td className="mono">{r.code}</td>
                      <td>{r.task}</td>
                      <td>{r.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <p style={{ marginTop: 28, fontSize: '.85rem', color: 'var(--mut)', lineHeight: 1.6, maxWidth: '64ch' }}>
            Code numbers shown as &ldquo;e.g.&rdquo; are placeholders illustrating the category band, not
            assignments from a DHS bulletin. Always validate against the current OLTL guidance or the
            code set maintained inside RayHealth.
          </p>
        </div>
      </section>

      {/* Cross-links */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-grid cols2">
            <Link to="/solutions/workforce-training" className="mk-card" style={{ display: 'block' }}>
              <div className="mk-ficon">
                {mkic(
                  <>
                    <path d="M22 10 12 5 2 10l10 5 10-5z" />
                    <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
                  </>,
                )}
              </div>
              <h3>Workforce &amp; training</h3>
              <p>How RayHealth credentials and trains caregivers so the right person performs each authorized task.</p>
              <p className="mk-line" style={{ marginTop: 12 }}>Explore workforce &amp; training &rarr;</p>
            </Link>
            <Link to="/resources/evv-guide" className="mk-card" style={{ display: 'block' }}>
              <div className="mk-ficon">
                {mkic(
                  <>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </>,
                )}
              </div>
              <h3>EVV guide</h3>
              <p>The end-to-end guide to electronic visit verification in Pennsylvania &mdash; from clock-in to claim.</p>
              <p className="mk-line" style={{ marginTop: 12 }}>Read the EVV guide &rarr;</p>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>The current code set, built into your care plans.</h2>
            <p>
              RayHealth ships the authoritative PA task codes in-product and keeps them aligned with
              OLTL guidance &mdash; so coordinators build care plans on the right codes, not a stale
              spreadsheet.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/resources/evv-guide" className="mk-btn mk-outline">Read the EVV guide</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
