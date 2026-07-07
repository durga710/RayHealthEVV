import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Resources › Guide: Everything Pennsylvania agencies need to know about EVV.
 * A neutral, educational reading page rendered in mk-prose. Facts are limited
 * to what is genuinely established: the 21st Century Cures Act EVV mandate and
 * its six required data elements, and Pennsylvania's Sandata/PROMISe model.
 */

interface DataElement {
  element: string;
  captures: string;
}

// The six federal data elements every EVV system must capture, per the
// 21st Century Cures Act (Section 12006), as published by CMS.
const sixElements: readonly DataElement[] = [
  { element: 'Type of service performed', captures: 'Which authorized service the visit covers (e.g., personal care, home health).' },
  { element: 'Individual receiving the service', captures: 'The Medicaid participant the visit was delivered to.' },
  { element: 'Date of the service', captures: 'The calendar date on which the visit occurred.' },
  { element: 'Location of service delivery', captures: 'Where care was provided, the home or approved community setting.' },
  { element: 'Individual providing the service', captures: 'The caregiver or direct-care worker who delivered the visit.' },
  { element: 'Time the service begins and ends', captures: 'The clock-in and clock-out that bound the visit duration.' },
];

const mistakes: readonly string[] = [
  'Late or manually edited clock-ins and clock-outs with no documented reason, a frequent audit flag.',
  'Visits that fall outside the participant’s authorized service dates, units, or hours.',
  'A service code billed that doesn’t match what the authorization actually approved.',
  'GPS or location data missing or inconsistent with the approved service setting.',
  'Caregiver on the claim who isn’t the verified worker who delivered the visit.',
  'EVV records that never reconcile to the claim submitted through PROMISe, causing mismatches.',
];

export function EvvGuidePage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Resources · Guide</span>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
            <span className="mk-pill">Guide</span>
            <span style={{ fontSize: '.8rem', color: 'var(--mut)', fontWeight: 500 }}>10 min read · Updated 2026</span>
          </div>
          <h1 className="mk-h1">Everything Pennsylvania agencies need to know about EVV.</h1>
          <p className="mk-lead">
            A plain-language guide to electronic visit verification, what the federal mandate requires,
            the six data elements every visit must capture, how Pennsylvania&rsquo;s model works, and the
            mistakes that quietly turn into denials.
          </p>
        </div>
      </header>

      {/* Body */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-prose">
            <p className="lead">
              Electronic visit verification (EVV) is how a Medicaid-funded home-care visit is proven to have
              actually happened, the right caregiver, with the right person, at the right place and time.
              For Pennsylvania agencies it isn&rsquo;t optional, and getting it wrong is one of the most common
              reasons claims get denied. This guide walks through what EVV is, where the requirement comes
              from, and what it takes to stay clean.
            </p>

            <h2>What EVV is</h2>
            <p>
              EVV is an electronic method of confirming that an in-home or community-based service was
              delivered as authorized. Rather than relying on a paper timesheet filled in after the fact,
              an EVV system records key details of each visit at the moment care happens, typically when a
              caregiver clocks in and out through a mobile app, a device in the home, or a telephone line.
            </p>
            <p>
              The goal is simple: create a verifiable, tamper-resistant record that the visit took place. That
              record protects participants from missed care, protects honest agencies from fraud accusations,
              and gives the state a consistent way to confirm that Medicaid dollars paid for real services.
            </p>

            <h2>The 21st Century Cures Act mandate</h2>
            <p>
              EVV is a federal requirement, not a state preference. Section 12006 of the
              {' '}<strong>21st Century Cures Act</strong> (enacted in 2016) directed states to require EVV for
              Medicaid-funded personal care services and home health care services. States that didn&rsquo;t
              implement EVV faced reductions in federal Medicaid matching funds, which is why every state , 
              Pennsylvania included, now operates an EVV program.
            </p>
            <p>
              The law sets a federal floor: it defines the data every EVV system must capture and the
              services it applies to, while leaving states room to choose how they implement it. That&rsquo;s why
              the data elements below are consistent nationwide, even though the systems and aggregators
              differ from state to state.
            </p>

            <h2>The six required federal data elements</h2>
            <p>
              Under the Cures Act, every EVV system, regardless of vendor or state, must electronically
              verify six things about each visit. If any one of them is missing or can&rsquo;t be substantiated,
              the visit record is incomplete and the resulting claim is at risk.
            </p>
            <table className="mk-tbl">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '42%' }}>Element</th>
                  <th scope="col">What it captures</th>
                </tr>
              </thead>
              <tbody>
                {sixElements.map((e) => (
                  <tr key={e.element}>
                    <td>{e.element}</td>
                    <td>{e.captures}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>How Pennsylvania&rsquo;s model works</h2>
            <p>
              Pennsylvania uses an <strong>aggregator model</strong>. The Department of Human Services (DHS)
              contracts with <strong>Sandata</strong> as the state&rsquo;s EVV aggregator. Agencies may use the
              state-provided Sandata system directly, or use an approved third-party (&ldquo;alternate&rdquo;) EVV
              system that sends its visit data to the Sandata aggregator. Either way, the verified visit
              data has to land in the state aggregator.
            </p>
            <p>
              From there, claims for those services are billed through Pennsylvania&rsquo;s Medicaid
              (&ldquo;Medical Assistance&rdquo;) claims system, <strong>PROMISe</strong>. The practical consequence is
              that your EVV records and your PROMISe claims need to line up: a claim that doesn&rsquo;t reconcile
              to a matching verified visit is exactly the kind of thing that gets rejected. A good operational
              setup treats EVV capture and claim submission as one connected flow, not two separate chores.
            </p>

            <h2>Common mistakes that cause denials</h2>
            <p>
              Most EVV denials don&rsquo;t come from outright fraud, they come from small data problems that
              break the link between the visit and the claim. These are the ones that show up again and again:
            </p>
            <ul className="mk-checks">
              {mistakes.map((m) => (
                <li key={m}><span className="mk-ck">{mkic(MK_CHECK)}</span>{m}</li>
              ))}
            </ul>

            <h2>How RayHealth handles it</h2>
            <p>
              RayHealth captures all six required elements at the moment of care, the caregiver clocks in and
              out from the field, with location and time recorded, and keeps that verified visit tied to the
              authorization behind it. Because scheduling, verification, and billing live in one system, the
              visit that&rsquo;s captured is the visit that gets billed, and the data is formatted to flow to the
              Sandata aggregator and reconcile against PROMISe.
            </p>
            <p>
              For a deeper look at how verification works inside the platform, see
              {' '}<Link to="/solutions/electronic-visit-verification" className="mk-line">RayHealth&rsquo;s EVV solution →</Link>{' '}
              and the
              {' '}<Link to="/resources/task-codes" className="mk-line">task code reference →</Link>{' '}
              for matching services to what was authorized.
            </p>
            <p style={{ fontSize: '.9rem', color: 'var(--mut)' }}>
              This guide is educational and general in nature. Program rules and aggregator requirements
              change over time, confirm current specifics with Pennsylvania DHS before making compliance
              decisions.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Turn EVV from a chore into a clean claim.</h2>
            <p>
              See how RayHealth captures all six elements in the field and carries them straight through to a
              defensible, PROMISe-ready claim.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/solutions/electronic-visit-verification" className="mk-btn mk-outline">Explore EVV</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
