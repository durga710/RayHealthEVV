import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Platform › RayVerify — the verification / trust engine that powers RayHealthEVV.
 *
 * Positioning: what Radar is to Stripe, RayVerify is to EVV. It layers identity,
 * location, device and fraud intelligence on top of every visit and produces an
 * explainable trust score plus an audit-ready evidence package.
 *
 * TRUTH GUARDRAIL (see docs/rayverify-integration.md §7): only GPS/geofencing and
 * fraud intelligence run on production data today. Identity, liveness and
 * device-trust are flagged "Rolling out" everywhere they appear — never sold as live.
 */

type Status = 'live' | 'soon';

const statusPill = (s: Status) => (
  <span
    style={{
      fontSize: '.66rem',
      fontWeight: 700,
      letterSpacing: '.03em',
      textTransform: 'uppercase',
      padding: '.2rem .55rem',
      borderRadius: 999,
      background: s === 'live' ? '#e7f6ec' : '#fdeee4',
      color: s === 'live' ? '#0a7d3f' : '#c2541a',
      border: `1px solid ${s === 'live' ? '#bfe6cb' : '#f6cdab'}`,
    }}
  >
    {s === 'live' ? 'Live' : 'Rolling out'}
  </span>
);

interface Layer {
  t: string;
  b: string;
  s: Status;
  i: React.ReactNode;
}

const layers: Layer[] = [
  { t: 'Location verification', s: 'live', b: 'GPS at clock-in and clock-out, checked against the client’s geofenced service address with a per-client radius.',
    i: mkic(<><circle cx="12" cy="10" r="3" /><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" /></>) },
  { t: 'Fraud intelligence', s: 'live', b: 'Impossible-travel, duplicate visits, shared-device patterns and over-billing anomalies — scored on every visit with a plain-English reason.',
    i: mkic(<><path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4Z" /><path d="m9 12 2 2 4-4" /></>) },
  { t: 'Identity verification', s: 'soon', b: 'A selfie match confirming the person clocking in is the authorized caregiver on the assignment — not a borrowed phone.',
    i: mkic(<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>) },
  { t: 'Liveness detection', s: 'soon', b: 'Confirms a real, present person — defeating photos, screen replays and deepfakes at the moment of capture.',
    i: mkic(<><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /><circle cx="12" cy="12" r="4" /></>) },
  { t: 'Device trust', s: 'soon', b: 'Flags emulators, rooted/jailbroken devices and one phone shared across many caregivers — the tells of coordinated fraud.',
    i: mkic(<><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M11 18h2" /></>) },
  { t: 'Evidence package', s: 'live', b: 'Every verified visit yields a tamper-evident record — location, signals, score and reasons — your agency can stand behind in an audit.',
    i: mkic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></>) },
];

interface Signal {
  t: string;
  b: string;
}

const signals: Signal[] = [
  { t: 'Impossible travel', b: 'Two visits too far apart to reach in the elapsed time — the caregiver could not physically have been at both.' },
  { t: 'Geofence breach', b: 'Clock-in or clock-out recorded outside the client’s authorized service-address radius.' },
  { t: 'Duplicate visit', b: 'The same visit window submitted more than once, or overlapping visits for one caregiver.' },
  { t: 'Over-billing', b: 'Units billed beyond the visit’s actual duration or the authorization’s allowance.' },
  { t: 'Shared device', b: 'One device clocking in caregivers who shouldn’t share hardware — a classic collusion signal.' },
  { t: 'Off-hours anomaly', b: 'A visit pattern that breaks the caregiver’s and client’s normal schedule baseline.' },
];

interface Step {
  n: string;
  t: string;
  b: string;
}

const steps: Step[] = [
  { n: '01', t: 'Capture', b: 'The caregiver clocks in from the RayHealth app. Location, time, device and visit context are captured at the door.' },
  { n: '02', t: 'Verify', b: 'RayVerify runs each signal against the authorization, the geofence, and the caregiver’s and client’s history.' },
  { n: '03', t: 'Score', b: 'Signals combine into a 0–100 trust score with a human-readable reason for everything that fired.' },
  { n: '04', t: 'Decide', b: 'Clean visits pass straight through; risky ones are flagged for review before they ever reach a claim.' },
];

interface Stat {
  v: string;
  l: string;
}

const stats: Stat[] = [
  { v: '0–100', l: 'Explainable trust score on every visit' },
  { v: 'GPS', l: 'Geofence-anchored at clock-in and clock-out' },
  { v: '6+', l: 'Fraud signals scored per visit today' },
  { v: 'Audit', l: 'Tamper-evident evidence package on file' },
];

interface Faq {
  q: string;
  a: string;
}

const faqs: Faq[] = [
  { q: 'What is RayVerify?', a: 'RayVerify is the verification engine inside RayHealthEVV. Where EVV proves a phone was near an address at a time, RayVerify adds a trust layer — location, device and fraud intelligence today, with identity and liveness rolling out — and turns each visit into an explainable trust score with an audit-ready evidence package.' },
  { q: 'What is live today versus rolling out?', a: 'Live today: GPS geofencing and the fraud-intelligence signals (impossible travel, geofence breach, duplicates, over-billing, shared-device and schedule anomalies), plus the evidence package. Rolling out: biometric identity verification, liveness detection and device-trust scoring. We flag those clearly everywhere so you always know what is running on real visit data.' },
  { q: 'How is the trust score explainable?', a: 'Every signal that contributes to a visit’s score comes with a plain-English reason — not a black-box number. Reviewers see exactly why a visit was flagged, which is what makes the score defensible in front of an auditor.' },
  { q: 'Do I need RayVerify to use RayHealthEVV?', a: 'No. GPS-verified EVV works on its own. RayVerify is the trust layer on top — turn it on per agency when you want fraud scoring and verification evidence beyond a basic location ping.' },
];

const Chrome = ({ url }: { url: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '0 4px 14px' }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
    <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--mut)', fontWeight: 500 }}>{url}</span>
  </div>
);

interface ScoreRow {
  l: string;
  v: string;
  ok: boolean;
}

const scoreRows: ScoreRow[] = [
  { l: 'Geofence', v: 'Inside radius (38 m)', ok: true },
  { l: 'Impossible travel', v: 'No conflict', ok: true },
  { l: 'Duplicate check', v: 'Unique visit', ok: true },
  { l: 'Billed units', v: 'Within authorization', ok: true },
  { l: 'Device pattern', v: 'Consistent device', ok: true },
];

export function RayVerifyPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Platform &middot; RayVerify</span>
          <h1 className="mk-h1">The trust engine for every home-care visit.</h1>
          <p className="mk-lead">
            What Radar is to Stripe, RayVerify is to EVV. It layers location, device and fraud intelligence
            on top of every visit &mdash; with identity and liveness rolling out &mdash; and turns each one into an
            explainable trust score and an audit-ready evidence package.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">Book a demo</Link>
            <a href="#layers" className="mk-btn mk-ghost">See the layers</a>
          </div>
        </div>
      </header>

      {/* Layers */}
      <section id="layers" className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">Verification, layered</p>
          <h2 className="mk-h2">More than a GPS ping.</h2>
          <p className="mk-deck">
            Time-and-place proves a phone was near an address. RayVerify proves the right caregiver actually
            delivered the visit &mdash; and scores the risk if something looks off.
          </p>
          <div className="mk-grid">
            {layers.map((l) => (
              <div className="mk-card" key={l.t}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="mk-ficon">{l.i}</div>
                  {statusPill(l.s)}
                </div>
                <h3>{l.t}</h3>
                <p>{l.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The score, explained — crafted visual */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">Explainable by design</p>
              <h3>A trust score you can defend, signal by signal.</h3>
              <p>
                RayVerify scores each visit from 0 to 100 and shows exactly why. No black box — every signal
                that fired comes with a plain-English reason, so a reviewer (or an auditor) sees the evidence,
                not just a number.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Geofence-anchored against the client’s service address</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Fraud signals scored on every visit today</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Tamper-evident evidence package retained per visit</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com &middot; RayVerify · Visit #4821" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: 'conic-gradient(#16a34a 0 96%, #e8eae4 96% 100%)' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--paper)', display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--ink)', fontSize: '1.05rem' }}>96</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.95rem' }}>Verified &mdash; low risk</div>
                    <div style={{ fontSize: '.82rem', color: 'var(--mut)', marginTop: 2 }}>5 of 5 live checks passed</div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  {scoreRows.map((r, i) => (
                    <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: '.82rem' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#e7f6ec', color: '#16a34a', flexShrink: 0 }}>{mkic(MK_CHECK)}</span>
                      <span style={{ color: 'var(--mut)', minWidth: 122 }}>{r.l}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600, marginLeft: 'auto' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fraud signals */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">Fraud intelligence &middot; live today</p>
          <h2 className="mk-h2">The signals RayVerify scores on every visit.</h2>
          <p className="mk-deck">These run on real visit data now — each one contributes to the trust score with a reason a human can read.</p>
          <div className="mk-grid">
            {signals.map((s) => (
              <div className="mk-card" key={s.t}>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it operates */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">How it operates</p>
          <h2 className="mk-h2">From clock-in to a decision.</h2>
          <p className="mk-deck">Every visit moves from capture to a scored, defensible decision before it ever reaches a claim.</p>
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

      {/* What's live */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <p className="mk-eylabel">Honest roadmap</p>
          <h2 className="mk-h2">What’s running on real visits today.</h2>
          <p className="mk-deck">We tell you exactly what’s live and what’s rolling out — so you never have to guess what the badge means.</p>
          <table className="mk-tbl" style={{ marginTop: 28 }}>
            <thead>
              <tr><th>Capability</th><th>Status</th><th>What it does</th></tr>
            </thead>
            <tbody>
              {layers.map((l) => (
                <tr key={l.t}>
                  <td>{l.t}</td>
                  <td>{statusPill(l.s)}</td>
                  <td style={{ color: 'var(--body)' }}>{l.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">RayVerify, answered.</h2></div>
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
            <h2>See a visit verified, signal by signal.</h2>
            <p>We’ll run a clean visit and a risky one through RayVerify and show you the score, the reasons, and the evidence package behind each.</p>
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
