import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Demo, rebuilt on the shared SiteLayout (teal/orange brand). Replaces the
 * old MarketingShell version that mixed leftover blue shadows/borders with
 * the new palette. Crafted visuals use only brand vars (--accent teal,
 * --accent2 orange) and neutral hairlines.
 */

interface Step {
  label: string;
  title: string;
  caption: string;
}

const steps: readonly Step[] = [
  { label: 'Step 1 · Caregiver', title: 'Clock in, gloves on', caption: 'GPS-verified one-tap clock-in. Works offline; queues and retries when signal returns.' },
  { label: 'Step 2 · Verify', title: 'Six elements captured', caption: 'Every federal EVV element is captured the moment the visit begins, no extra taps.' },
  { label: 'Step 3 · Coordinator', title: 'Visit review queue', caption: 'Exceptions surface with the data points alongside. Approve, file, or escalate in one click.' },
  { label: 'Step 4 · Export', title: 'State aggregator file', caption: 'A Sandata-aligned export with 6/6 federal elements, reconciliation-ready.' },
];

const audiences: readonly { who: string; title: string; body: string }[] = [
  { who: 'For caregivers', title: 'One-tap, gloves on', body: 'Tap clock-in. Phone confirms within 30 seconds. Done, even with no signal at the door.' },
  { who: 'For coordinators', title: 'One queue per day', body: 'Visit Review surfaces every exception with the federal data points alongside it.' },
  { who: 'For owners', title: 'One vendor', body: 'Scheduling, EVV, and the audit trail in one workflow, stop reconciling four spreadsheets.' },
];

/** Small browser-chrome wrapper, brand-neutral hairlines only. */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--paper)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d8dcd6' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d8dcd6' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d8dcd6' }} />
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function pill(bg: string, color: string, text: string) {
  return (
    <span style={{ background: bg, color, fontSize: '.6rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999 }}>
      {text}
    </span>
  );
}

export function DemoPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Demo</span>
          <h1 className="mk-h1">See a real visit, end-to-end.</h1>
          <p className="mk-lead">
            From a caregiver's one-tap clock-in to a state-aggregator export, the whole verified
            visit, in about two minutes. Book a walkthrough on your own caseload.
          </p>
          <div className="mk-herocta">
            <Link to="/contact" className="mk-btn mk-pri">Book a live walkthrough</Link>
            <Link to="/solutions/electronic-visit-verification" className="mk-btn mk-ghost">How EVV works</Link>
          </div>
        </div>
      </header>

      {/* Four-step flow */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-center">
            <p className="mk-eylabel">The flow</p>
            <h2 className="mk-h2">Every visit, every step, audit-trail clean.</h2>
          </div>

          <div className="mk-grid cols4" style={{ marginTop: 40 }}>
            {steps.map((s, i) => (
              <div className="mk-card" key={s.title}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--accent2-deep)' }}>{s.label}</div>
                <h3 style={{ marginTop: 8 }}>{s.title}</h3>

                <div style={{ marginTop: 14 }}>
                  {i === 0 && (
                    <Chrome>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--ink)' }}>Mrs. K. Anders</span>
                        {pill('var(--accent-tint)', 'var(--accent-deep)', 'Scheduled')}
                      </div>
                      <div style={{ fontSize: '.62rem', color: 'var(--mut)', marginBottom: 10 }}>Tue 9:00 AM · W1793 Personal care</div>
                      <div style={{ background: 'var(--accent)', color: '#fff', textAlign: 'center', borderRadius: 8, padding: '8px 0', fontSize: '.72rem', fontWeight: 600 }}>Clock in</div>
                      <div style={{ fontSize: '.58rem', color: 'var(--mut)', textAlign: 'center', marginTop: 8 }}>GPS verified · 12 ft accuracy</div>
                    </Chrome>
                  )}
                  {i === 1 && (
                    <Chrome>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {['Type of service', 'Individual served', 'Caregiver', 'Date & time', 'Location', 'Service begins/ends'].map((el) => (
                          <div key={el} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.62rem', color: 'var(--ink-soft)' }}>
                            <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>{mkic(MK_CHECK)}</span>
                            {el}
                          </div>
                        ))}
                      </div>
                    </Chrome>
                  )}
                  {i === 2 && (
                    <Chrome>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 7, borderRadius: 6, background: 'var(--accent-tint)', borderLeft: '3px solid var(--accent)', marginBottom: 6 }}>
                        {pill('var(--accent)', '#fff', 'Verified')}
                        <span style={{ fontSize: '.6rem', color: 'var(--ink)' }}>K. Anders · 2.93 hrs</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 7, borderRadius: 6, background: 'var(--accent2-tint)', borderLeft: '3px solid var(--accent2)' }}>
                        {pill('var(--accent2)', '#fff', 'Flagged')}
                        <span style={{ fontSize: '.6rem', color: 'var(--ink)' }}>R. Patel · late clock-out</span>
                      </div>
                    </Chrome>
                  )}
                  {i === 3 && (
                    <Chrome>
                      <div style={{ background: 'var(--ink-bg)', color: '#cfe6e9', borderRadius: 6, padding: '8px 10px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.55rem', lineHeight: 1.7 }}>
                        <div><span style={{ color: '#5fd0d6' }}>service:</span> W1793</div>
                        <div><span style={{ color: '#5fd0d6' }}>clock-in:</span> 09:02:17</div>
                        <div><span style={{ color: '#5fd0d6' }}>lat/long:</span> 40.43, -79.99</div>
                      </div>
                      <div style={{ fontSize: '.58rem', color: 'var(--mut)', textAlign: 'center', marginTop: 8 }}>Sandata-aligned · 6/6 elements</div>
                    </Chrome>
                  )}
                </div>

                <p style={{ marginTop: 14, fontSize: '.85rem', lineHeight: 1.55, color: 'var(--body)' }}>{s.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <div className="mk-grid">
            {audiences.map((a) => (
              <div className="mk-card" key={a.who}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>{a.who}</div>
                <h3 style={{ marginTop: 8 }}>{a.title}</h3>
                <p style={{ marginTop: 8, fontSize: '.93rem', lineHeight: 1.6, color: 'var(--body)' }}>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>Book a live walkthrough.</h2>
            <p>30 minutes with your authorizations, task codes, and a real verified visit, not a generic slideshow.</p>
            <div className="mk-herocta">
              <Link to="/contact" className="mk-btn mk-white">Talk to sales</Link>
              <Link to="/pricing" className="mk-btn mk-outline">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
