import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Solutions › Electronic Visit Verification.
 * GPS-verified clock-in/out that captures the six federal EVV elements,
 * works offline with a telephony/IVR fallback, keeps tamper-evident records,
 * and maps to the Sandata aggregator Pennsylvania uses.
 */

interface Pillar {
  t: string;
  b: string;
  i: React.ReactNode;
}

const pillars: Pillar[] = [
  { t: 'GPS clock-in / clock-out', b: 'Caregivers verify each visit from the mobile app. Location is captured at the start and end of service — not typed in after the fact.',
    i: mkic(<><circle cx="12" cy="10" r="3" /><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" /></>) },
  { t: 'The six federal data elements', b: 'Every visit captures all six elements the 21st Century Cures Act requires — automatically, on every clock-in and clock-out.',
    i: mkic(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>) },
  { t: 'Offline capture', b: 'No signal at the home? The visit is captured on the device and syncs automatically once connectivity returns — nothing is lost.',
    i: mkic(<><path d="M5 12.55a11 11 0 0 1 14 0M8.5 16.1a6 6 0 0 1 7 0M12 20h.01" /><path d="M2 2l20 20" /></>) },
  { t: 'Telephony / IVR fallback', b: 'For homes without a smartphone, caregivers verify by phone from the client’s landline — the same visit record, captured by call.',
    i: mkic(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></>) },
  { t: 'Tamper-evident records', b: 'Once a visit is verified, the record is locked. Edits are tracked with who, what, and when — so the audit trail is defensible.',
    i: mkic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>) },
  { t: 'Sandata aggregator mapping', b: 'Visits map to the data format Pennsylvania’s state aggregator expects, so verified visits flow toward billing without re-keying.',
    i: mkic(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>) },
];

interface DataElement {
  n: string;
  t: string;
  b: string;
}

const elements: DataElement[] = [
  { n: '01', t: 'Type of service', b: 'The specific service performed during the visit, recorded against the client’s plan.' },
  { n: '02', t: 'Individual receiving the service', b: 'The client served — tied to their authorization and care plan.' },
  { n: '03', t: 'Individual providing the service', b: 'The caregiver who delivered the visit, verified at clock-in.' },
  { n: '04', t: 'Date of service', b: 'The calendar date the service was actually delivered.' },
  { n: '05', t: 'Location of service', b: 'Where the service was delivered, captured by GPS or telephony at the home.' },
  { n: '06', t: 'Time the service begins and ends', b: 'Clock-in and clock-out times, recorded at the moment of service.' },
];

interface Step {
  n: string;
  t: string;
  b: string;
}

const steps: Step[] = [
  { n: '01', t: 'Arrive & clock in', b: 'The caregiver opens the app at the home and clocks in. GPS confirms location and the start time is stamped.' },
  { n: '02', t: 'Deliver the visit', b: 'Care is delivered and tasks are logged. With no signal, everything is captured on-device for later sync.' },
  { n: '03', t: 'Clock out', b: 'Clock-out stamps the end time and location. All six federal elements are now captured for the visit.' },
  { n: '04', t: 'Verify & map', b: 'The locked, tamper-evident record maps to the Sandata format and flows toward billing — no re-keying.' },
];

interface Stat {
  v: string;
  l: string;
}

const stats: Stat[] = [
  { v: '6 / 6', l: 'Federal EVV data elements captured per visit' },
  { v: 'GPS', l: 'Location verified at clock-in and clock-out' },
  { v: 'Offline', l: 'Visits captured without signal, synced later' },
  { v: 'Sandata', l: 'Mapped to PA’s state aggregator format' },
];

interface Faq {
  q: string;
  a: string;
}

const faqs: Faq[] = [
  { q: 'What are the six federal EVV data elements?', a: 'The 21st Century Cures Act requires every EVV visit to capture: the type of service, the individual receiving the service, the individual providing the service, the date of service, the location of service, and the time the service begins and ends. RayHealth captures all six on every clock-in and clock-out.' },
  { q: 'What happens when there’s no cell signal at the home?', a: 'The visit is captured on the device — including GPS location at clock-in and clock-out — and syncs automatically once connectivity returns. For homes without a smartphone, caregivers can verify by phone using the telephony/IVR fallback from the client’s landline.' },
  { q: 'How does RayHealth keep records tamper-evident?', a: 'Once a visit is verified it’s locked, and any later correction is recorded with who made the change, what changed, and when. That edit history travels with the visit, so the record stays defensible in an audit.' },
  { q: 'How does this work with Pennsylvania’s aggregator?', a: 'Pennsylvania uses the Sandata state aggregator for EVV. RayHealth maps verified visits to the data format the aggregator expects so they flow toward billing without manual re-entry. Confirm your program’s current submission requirements with PA DHS.' },
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

interface VerifyRow {
  l: string;
  v: string;
}

const verifyRows: VerifyRow[] = [
  { l: 'Type of service', v: 'Personal care (W1793)' },
  { l: 'Receiving', v: 'E. Daniels' },
  { l: 'Providing', v: 'M. Santos' },
  { l: 'Date', v: 'Jun 27, 2026' },
  { l: 'Begins / ends', v: '8:02 AM – 10:01 AM' },
];

export function EvvSolutionPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Solutions &middot; EVV</span>
          <h1 className="mk-h1">Electronic visit verification that holds up to an audit.</h1>
          <p className="mk-lead">
            RayHealth verifies every visit at the door &mdash; GPS at clock-in and clock-out, all six federal data
            elements captured automatically, offline and telephony fallbacks for tough homes, and tamper-evident
            records that map to Pennsylvania&rsquo;s Sandata aggregator.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">Book a demo</Link>
            <a href="#elements" className="mk-btn mk-ghost">See the six elements</a>
          </div>
        </div>
      </header>

      {/* Pillars */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">Verification, end to end</p>
          <h2 className="mk-h2">Capture the visit the way the rules require.</h2>
          <p className="mk-deck">EVV isn&rsquo;t a checkbox after the fact. RayHealth captures each visit as it happens — even when the home has no signal — and keeps the record defensible.</p>
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

      {/* The six federal data elements */}
      <section id="elements" className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">21st Century Cures Act</p>
          <h2 className="mk-h2">The six federal EVV data elements.</h2>
          <p className="mk-deck">Federal law requires every EVV visit to capture these six elements. RayHealth records all six on each clock-in and clock-out — no manual entry, no gaps.</p>
          <div className="mk-grid cols3">
            {elements.map((e) => (
              <div className="mk-card" key={e.n}>
                <div className="mk-ficon" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{e.n}</div>
                <h3>{e.t}</h3>
                <p>{e.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dives with crafted visuals */}
      <section className="mk-sec">
        <div className="mk-wrap">
          {/* GPS verify visual */}
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">GPS verification</p>
              <h3>Location captured at the door, not the desk.</h3>
              <p>When a caregiver clocks in, RayHealth captures GPS location and the timestamp on the spot. Every required element is checked off as the visit happens — so verification is built in, not reconstructed.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>GPS location at both clock-in and clock-out</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>All six federal elements captured automatically</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Offline-safe: captured on-device, synced later</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="RayHealth mobile &middot; Visit verified" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                {/* map box with a pin */}
                <div style={{ position: 'relative', height: 132, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', background: 'linear-gradient(135deg,#eef3ee,#e4ece6)' }}>
                  <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px)', backgroundSize: '26px 26px', opacity: 0.7 }} />
                  <div aria-hidden style={{ position: 'absolute', top: 26, left: 0, right: 0, height: 8, background: '#cfe0d4' }} />
                  <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: '62%', width: 10, background: '#cfe0d4' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-100%)', color: 'var(--accent-deep)' }}>
                    {mkic(<><circle cx="12" cy="10" r="3" /><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" /></>)}
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, left: 8 }}>{pill('#e7f3f4', '#0c5d66', 'Within client home')}</div>
                </div>
                {/* element checklist */}
                <div style={{ marginTop: 12 }}>
                  {verifyRows.map((r, i) => (
                    <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: '.82rem' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#e7f6ec', color: '#16a34a', flexShrink: 0 }}>{mkic(MK_CHECK)}</span>
                      <span style={{ color: 'var(--mut)', minWidth: 96 }}>{r.l}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600, marginLeft: 'auto' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tamper-evident / fallback visual */}
          <div className="mk-feat rev">
            <div className="mk-feattext">
              <p className="mk-eylabel">Resilient &amp; defensible</p>
              <h3>Works in tough homes, locks when it counts.</h3>
              <p>A home with no smartphone or no signal still gets a clean record — by telephony or offline sync. Once a visit is verified, it&rsquo;s locked, and every correction is tracked for the audit trail.</p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Telephony / IVR fallback from the client&rsquo;s landline</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Locked records with full who/what/when edit history</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Mapped to PA&rsquo;s Sandata aggregator format</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com &middot; Visit #4821" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.9rem' }}>Visit verified &amp; locked</div>
                  {pill('#e7f3f4', '#0c5d66', 'Mapped to Sandata')}
                </div>
                <div style={{ display: 'flex', gap: '.6rem', marginTop: 12, padding: 12, background: '#e7f3f4', borderRadius: 10, border: '1px solid #cdeede' }}>
                  <span style={{ color: '#0c5d66', flexShrink: 0 }}>{mkic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)}</span>
                  <div style={{ fontSize: '.82rem', color: '#0a5c40', lineHeight: 1.5 }}>
                    <strong>Tamper-evident.</strong> Verified by GPS at 10:01 AM. Any edit is logged with user and timestamp.
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  {[
                    { l: 'Captured via', v: 'Mobile GPS' },
                    { l: 'Fallback available', v: 'Telephony / IVR' },
                    { l: 'Aggregator', v: 'Sandata (PA)' },
                  ].map((r, i) => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: '.82rem' }}>
                      <span style={{ color: 'var(--mut)' }}>{r.l}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it operates */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">How it operates</p>
          <h2 className="mk-h2">From the doorstep to the aggregator.</h2>
          <p className="mk-deck">Each visit moves from capture to a locked, mappable record without anyone re-typing what already happened.</p>
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
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">EVV, answered.</h2></div>
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
            <h2>See a verified visit, start to finish.</h2>
            <p>We&rsquo;ll run a sample clock-in, capture all six elements, drop signal mid-visit, and show you the record sync clean and map to Sandata.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/platform/compliance" className="mk-btn mk-outline">Explore compliance</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
