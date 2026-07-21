import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * RayVerify, the "trust engine" band on the landing page.
 *
 * Positioned as the verification layer that powers RayHealthEVV (Stripe → Radar).
 * A dark premium section with a scroll-animated verification pipeline. Copy is
 * deliberately scoped to what is true today: GPS geofencing and fraud
 * intelligence are LIVE; identity / liveness / device-trust are flagged as
 * rolling out (see docs/rayverify-integration.md §7).
 */

function icon(path: ReactNode) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

interface Stage {
  label: string;
  detail: string;
  status: 'live' | 'soon';
  glyph: ReactNode;
}

const PIPELINE: Stage[] = [
  { label: 'Identity', detail: 'Selfie match to the authorized caregiver', status: 'soon', glyph: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></> },
  { label: 'Liveness', detail: 'Real person, not a photo or replay', status: 'soon', glyph: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /><circle cx="12" cy="12" r="4" /></> },
  { label: 'Location', detail: 'GPS inside the client geofence', status: 'live', glyph: <><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></> },
  { label: 'Device trust', detail: 'Genuine device, not an emulator', status: 'soon', glyph: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M11 18h2" /></> },
  { label: 'Fraud engine', detail: 'Impossible travel, duplicates, geofence & duration anomalies', status: 'live', glyph: <><path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4Z" /><path d="m9 12 2 2 4-4" /></> },
];

const LAYERS = [
  { k: 'Beyond GPS', t: 'Location is table stakes', b: 'Time-and-place proves a phone was near an address. RayVerify proves the right caregiver was actually there.' },
  { k: 'Explainable', t: 'Every score, in plain English', b: 'A 0-100 fraud score with a human-readable reason for each signal, built for auditors, not black boxes.' },
  { k: 'Audit-ready', t: 'Evidence, captured by default', b: 'Each visit produces a tamper-evident verification package your agency can stand behind in a review.' },
];

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Section styles, co-located like LandingPage's CSS component. Every color
 * aliases a token already defined on `.rh` (the section renders inside it),
 * so the band inherits the same palette as the rest of the landing page.
 */
function SectionCSS() {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
.rvfy{position:relative; overflow:hidden; background:var(--dark); padding:104px 0;}
.rvfy-bloom{position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(52% 64% at 16% 6%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 72%),
    radial-gradient(42% 52% at 90% 96%, color-mix(in srgb, var(--accent2) 12%, transparent), transparent 72%);}
.rvfy-in{position:relative; max-width:var(--maxw); margin:0 auto; padding:0 24px;}

.rvfy-head{max-width:740px;}
.rvfy-eyebrow{display:inline-flex; align-items:center; gap:.55rem; font-size:.78rem; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--accent-light);}
.rvfy-pip{width:8px; height:8px; border-radius:50%; background:var(--accent-light); animation:rvfy-pip 2.4s ease-out infinite;}
@keyframes rvfy-pip{from{box-shadow:0 0 0 0 color-mix(in srgb, var(--accent-light) 55%, transparent);} to{box-shadow:0 0 0 10px transparent;}}
.rvfy .rvfy-title{color:#fff; font-size:clamp(1.9rem,3.4vw,2.6rem); line-height:1.1; letter-spacing:-.03em; margin-top:14px;}
.rvfy-em{color:var(--accent-light);}
.rvfy-deck{color:var(--dark-text-muted); font-size:1.0625rem; line-height:1.65; margin-top:16px; max-width:62ch;}

.rvfy-body{display:grid; grid-template-columns:1.05fr 1fr; gap:48px; margin-top:56px; align-items:start;}

/* pipeline card */
.rvfy-pipe{position:relative; border:1px solid var(--dark-line); background:rgba(255,255,255,.04); border-radius:20px; padding:28px 28px 28px 30px;}
.rvfy-pipe-rail{position:absolute; left:49px; top:48px; bottom:48px; width:2px; border-radius:1px; background:var(--dark-line); overflow:hidden;}
.rvfy-pulse{position:absolute; left:0; width:100%; height:64px; transform:translateY(-50%); background:linear-gradient(to bottom, transparent, var(--accent-light), transparent);}
.rvfy-stages{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:22px; position:relative;}
.rvfy-stage{display:flex; gap:16px; align-items:flex-start;}
.rvfy-node{position:relative; z-index:1; flex:none; width:40px; height:40px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:var(--accent-light); background:color-mix(in srgb, var(--dark) 88%, white 12%); border:1px solid var(--dark-line);}
.rvfy-node-ok{background:var(--accent); color:#fff; border-color:transparent; box-shadow:0 0 26px -6px color-mix(in srgb, var(--accent) 75%, transparent);}
.rvfy-stagetext{display:flex; flex-direction:column; gap:4px; padding-top:1px;}
.rvfy-stagelabel{display:flex; align-items:center; gap:10px; flex-wrap:wrap; color:#fff; font-weight:600; font-size:1rem;}
.rvfy-flag{font-size:.62rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:2.5px 9px; border-radius:999px;}
.rvfy-flag.live{background:color-mix(in srgb, var(--accent) 32%, transparent); color:var(--accent-light); border:1px solid color-mix(in srgb, var(--accent-light) 38%, transparent);}
.rvfy-flag.soon{background:transparent; color:var(--dark-text-muted); border:1px solid var(--dark-line);}
.rvfy-stagedetail{color:var(--dark-text-muted); font-size:.9rem; line-height:1.55;}
.rvfy-verified{margin-top:4px; padding-top:22px; border-top:1px dashed var(--dark-line);}

/* value layers */
.rvfy-layers{display:flex; flex-direction:column; gap:24px;}
.rvfy-layer{padding-bottom:24px; border-bottom:1px solid var(--dark-line);}
.rvfy-layerk{font-size:.72rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--accent-light);}
.rvfy .rvfy-layert{color:#fff; font-size:1.25rem; letter-spacing:-.01em; margin-top:8px;}
.rvfy-layerb{color:var(--dark-text-muted); font-size:.9688rem; line-height:1.6; margin-top:8px;}
.rvfy-cta{display:flex; flex-direction:column; gap:14px; align-items:flex-start;}
.rvfy-btn{display:inline-flex; align-items:center; gap:.5rem; height:46px; padding:0 1.4rem; border-radius:10px; background:#fff; color:var(--ink); font-weight:600; font-size:.9375rem; transition:transform .16s ease, box-shadow .16s ease;}
.rvfy-btn:hover{transform:translateY(-1px); box-shadow:0 14px 30px -12px rgba(0,0,0,.55);}
.rvfy-foot{color:var(--dark-text-muted); font-size:.8125rem; line-height:1.6; max-width:54ch;}

@media(max-width:940px){
  .rvfy-body{grid-template-columns:1fr; gap:36px;}
}
@media(max-width:640px){
  .rvfy{padding:80px 0;}
  .rvfy-pipe{padding:22px;}
  .rvfy-pipe-rail{left:41px;}
}
@media(prefers-reduced-motion:reduce){
  .rvfy-pip{animation:none;}
  .rvfy-pulse{display:none;}
}
`,
    }}
    />
  );
}

export function RayVerifySection() {
  const reduce = useReducedMotion();
  const rise = (delay = 0) =>
    reduce
      ? { initial: { opacity: 1 }, whileInView: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease, delay },
          viewport: { once: true, amount: 0.4 },
        };

  return (
    <section id="rayverify" className="rvfy">
      <SectionCSS />
      <div className="rvfy-bloom" aria-hidden />
      <div className="rvfy-in">
        <motion.div className="rvfy-head" {...rise()}>
          <span className="rvfy-eyebrow"><span className="rvfy-pip" />Powered by RayVerify</span>
          <h2 className="rvfy-title">Every visit. <span className="rvfy-em">Verified.</span></h2>
          <p className="rvfy-deck">
            Home care deserves more than a GPS ping. RayVerify is the trust engine inside RayHealthEVV,
            layering identity, location, device, and fraud intelligence so you know the right caregiver
            delivered the right care, at the right place.
          </p>
        </motion.div>

        <div className="rvfy-body">
          {/* Animated verification pipeline */}
          <motion.div className="rvfy-pipe" {...rise(0.05)}>
            <div className="rvfy-pipe-rail" aria-hidden>
              {!reduce && (
                <motion.span
                  className="rvfy-pulse"
                  initial={{ top: '0%' }}
                  whileInView={{ top: '100%' }}
                  transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
                  viewport={{ once: false, amount: 0.3 }}
                />
              )}
            </div>
            <ul className="rvfy-stages">
              {PIPELINE.map((s, i) => (
                <motion.li
                  key={s.label}
                  className="rvfy-stage"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease, delay: 0.12 * i }}
                  viewport={{ once: true, amount: 0.6 }}
                >
                  <span className="rvfy-node">{icon(s.glyph)}</span>
                  <span className="rvfy-stagetext">
                    <span className="rvfy-stagelabel">
                      {s.label}
                      <span className={`rvfy-flag ${s.status}`}>{s.status === 'live' ? 'Live' : 'Rolling out'}</span>
                    </span>
                    <span className="rvfy-stagedetail">{s.detail}</span>
                  </span>
                </motion.li>
              ))}
              <motion.li
                className="rvfy-stage rvfy-verified"
                initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease, delay: 0.12 * PIPELINE.length }}
                viewport={{ once: true, amount: 0.6 }}
              >
                <span className="rvfy-node rvfy-node-ok">{icon(<path d="M20 6 9 17l-5-5" />)}</span>
                <span className="rvfy-stagetext">
                  <span className="rvfy-stagelabel">Verified visit</span>
                  <span className="rvfy-stagedetail">Cleared for billing, with evidence on file</span>
                </span>
              </motion.li>
            </ul>
          </motion.div>

          {/* Value layers */}
          <div className="rvfy-layers">
            {LAYERS.map((l, i) => (
              <motion.div key={l.t} className="rvfy-layer" {...rise(0.1 + 0.08 * i)}>
                <p className="rvfy-layerk">{l.k}</p>
                <h3 className="rvfy-layert">{l.t}</h3>
                <p className="rvfy-layerb">{l.b}</p>
              </motion.div>
            ))}
            <motion.div className="rvfy-cta" {...rise(0.34)}>
              <Link to="/rayverify" className="rvfy-btn">
                Learn about RayVerify
                {icon(<path d="M5 12h14M13 6l6 6-6 6" />)}
              </Link>
              <p className="rvfy-foot">
                GPS geofencing and fraud intelligence are live today. Identity, liveness, and device-trust
                layers are rolling out.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
