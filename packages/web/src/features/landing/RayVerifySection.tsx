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
  { label: 'Fraud engine', detail: 'Impossible travel, duplicates, anomalies', status: 'live', glyph: <><path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4Z" /><path d="m9 12 2 2 4-4" /></> },
];

const LAYERS = [
  { k: 'Beyond GPS', t: 'Location is table stakes', b: 'Time-and-place proves a phone was near an address. RayVerify proves the right caregiver was actually there.' },
  { k: 'Explainable', t: 'Every score, in plain English', b: 'A 0-100 fraud score with a human-readable reason for each signal, built for auditors, not black boxes.' },
  { k: 'Audit-ready', t: 'Evidence, captured by default', b: 'Each visit produces a tamper-evident verification package your agency can stand behind in a review.' },
];

const ease = [0.22, 1, 0.36, 1] as const;

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
      <div className="rvfy-bloom" aria-hidden />
      <div className="rvfy-in">
        <motion.div className="rvfy-head" {...rise()}>
          <span className="rvfy-eyebrow"><span className="rvfy-pip" />Powered by RayVerify</span>
          <h2 className="rvfy-title">Every visit. <span className="rvfy-em">Verified.</span></h2>
          <p className="rvfy-deck">
            Home care deserves more than a GPS ping. RayVerify is the trust engine inside RayHealthEVV , 
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
