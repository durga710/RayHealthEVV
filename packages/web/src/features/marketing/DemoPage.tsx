import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingShell } from './MarketingShell.js';

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '1.75rem',
  boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)'
};

// 4-step flow visual — pure inline-SVG/CSS, no external assets.
// Each card is a stylized mini-mockup of one screen in the real visit flow.
const flowCardBase: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '1.25rem',
  boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)',
  border: '1px solid #c9d8e8',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.75rem',
  width: '280px',
  minHeight: '340px',
  flexShrink: 0,
  transition: 'transform 200ms ease, box-shadow 200ms ease',
};

const stepLabel: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '0.7rem',
  fontWeight: 800,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: 'var(--color-accent)',
};

const stepTitle: React.CSSProperties = {
  color: 'var(--color-primary-dark)',
  margin: 0,
  fontSize: '0.95rem',
  lineHeight: 1.3,
  fontWeight: 700,
};

// Phone frame — rounded rect with a small notch dot.
function PhoneFrame({ children, height = 200 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '180px',
        height: `${height}px`,
        margin: '0 auto',
        backgroundColor: 'var(--color-primary-dark)',
        borderRadius: '22px',
        padding: '6px',
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.08)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '7px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '36px',
          height: '5px',
          backgroundColor: '#000',
          borderRadius: '999px',
        }}
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '14px 10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        border: '1px solid #c9d8e8',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(26, 95, 168, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 8px',
          backgroundColor: '#f4f7fb',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fc5d57' }} aria-hidden="true" />
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fcbe2e' }} aria-hidden="true" />
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34c84a' }} aria-hidden="true" />
        <div
          aria-hidden="true"
          style={{
            flex: 1,
            height: '12px',
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            marginLeft: '6px',
          }}
        />
      </div>
      <div style={{ padding: '10px' }}>{children}</div>
    </div>
  );
}

function FlowChevron({ direction }: { direction: 'right' | 'down' }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-accent)',
        fontFamily: 'var(--font-heading)',
        fontSize: '2rem',
        fontWeight: 900,
        lineHeight: 1,
        flexShrink: 0,
        padding: direction === 'right' ? '0 0.25rem' : '0.25rem 0',
        transform: direction === 'down' ? 'rotate(90deg)' : 'none',
      }}
    >
      ›
    </div>
  );
}

export function DemoPage() {
  return (
    <MarketingShell eyebrow="Demo" title="See a real visit, end-to-end, in two minutes.">
      <style>{`
        @keyframes rayhealth-pulse {
          0% { r: 18; opacity: 0.55; }
          100% { r: 44; opacity: 0; }
        }
        .rayhealth-pulse-ring {
          animation: rayhealth-pulse 2s ease-out infinite;
          transform-origin: center;
        }
        .rayhealth-pulse-ring.delay-1 { animation-delay: 0.66s; }
        .rayhealth-pulse-ring.delay-2 { animation-delay: 1.33s; }
        .rayhealth-flow-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(26, 95, 168, 0.14);
        }
        .rayhealth-flow-row {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding: 0.5rem 0.25rem 1rem;
        }
        .rayhealth-flow-chevron-down { display: none; }
        @media (max-width: 720px) {
          .rayhealth-flow-row {
            flex-direction: column;
            align-items: center;
            overflow-x: visible;
          }
          .rayhealth-flow-chevron-right { display: none; }
          .rayhealth-flow-chevron-down { display: flex; }
        }
      `}</style>
      <div
        style={{
          maxWidth: '960px',
          margin: '2rem auto 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
      >
        {/* 4-step real-flow visual — replaces previous "Coming soon" placeholder.
            Inline SVG + CSS only. No external images, no <video>. */}
        <section
          aria-label="Four-step visit flow — mock illustration of caregiver clock-in, haptic confirmation, coordinator review, and state aggregator export."
          style={{
            backgroundColor: 'var(--color-bg)',
            borderRadius: '20px',
            padding: '1.5rem 1rem',
            border: '1px solid #c9d8e8',
          }}
        >
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-heading)',
              fontSize: '0.95rem',
              fontWeight: 600,
              margin: '0 0 0.75rem',
              letterSpacing: '0.5px',
            }}
          >
            Every visit, every step, audit-trail clean.
          </p>
          <div className="rayhealth-flow-row">
            {/* STEP 1 — Caregiver clock-in (mobile mockup) */}
            <div className="rayhealth-flow-card" style={flowCardBase}>
              <div style={stepLabel}>Step 1 · Caregiver</div>
              <h3 style={stepTitle}>Clock in, gloves on</h3>
              <PhoneFrame>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-primary-dark)' }}>
                    RayHealth
                  </span>
                  <span
                    style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      fontSize: '0.5rem',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      padding: '2px 5px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Secure session
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: '#f4f7fb',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)', fontSize: '0.65rem' }}>Mrs. K. Anders</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem' }}>Tue 9:00 AM</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem' }}>W1793 Personal care</div>
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{
                    marginTop: 'auto',
                    backgroundColor: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px',
                    cursor: 'default',
                    boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)',
                  }}
                >
                  Clock in
                </button>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.5rem', textAlign: 'center' }}>
                  GPS verified · 12 ft accuracy
                </div>
              </PhoneFrame>
            </div>

            <FlowChevron direction="right" />
            <div className="rayhealth-flow-chevron-down" style={{ justifyContent: 'center' }}>
              <FlowChevron direction="down" />
            </div>

            {/* STEP 2 — 30-second haptic confirmation */}
            <div className="rayhealth-flow-card" style={flowCardBase}>
              <div style={stepLabel}>Step 2 · Haptic</div>
              <h3 style={stepTitle}>30-second confirmation</h3>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <svg
                  width="160"
                  height="140"
                  viewBox="0 0 160 140"
                  aria-hidden="true"
                  role="img"
                >
                  <title>Pulse animation</title>
                  {/* Phone outline */}
                  <rect
                    x="56"
                    y="20"
                    width="48"
                    height="100"
                    rx="8"
                    ry="8"
                    fill="none"
                    stroke="var(--color-primary-dark)"
                    strokeWidth="2"
                  />
                  <circle cx="80" cy="27" r="1.5" fill="var(--color-primary-dark)" />
                  {/* Pulse rings — center of phone */}
                  <circle
                    className="rayhealth-pulse-ring"
                    cx="80"
                    cy="70"
                    r="18"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                  />
                  <circle
                    className="rayhealth-pulse-ring delay-1"
                    cx="80"
                    cy="70"
                    r="18"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                  />
                  <circle
                    className="rayhealth-pulse-ring delay-2"
                    cx="80"
                    cy="70"
                    r="18"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                  />
                  <circle cx="80" cy="70" r="8" fill="var(--color-accent)" />
                </svg>
                {/* Vibration pattern bars: short/long alternating */}
                <div
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '4px',
                    height: '18px',
                  }}
                >
                  {[6, 14, 4, 14, 4, 14].map((h, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        width: '4px',
                        height: `${h}px`,
                        borderRadius: '2px',
                        backgroundColor: 'var(--color-primary-light)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.3 }}>
                  Fires 30 sec before shift · clock-in ready
                </div>
              </div>
            </div>

            <FlowChevron direction="right" />
            <div className="rayhealth-flow-chevron-down" style={{ justifyContent: 'center' }}>
              <FlowChevron direction="down" />
            </div>

            {/* STEP 3 — Coordinator visit review (web admin mockup) */}
            <div className="rayhealth-flow-card" style={flowCardBase}>
              <div style={stepLabel}>Step 3 · Coordinator</div>
              <h3 style={stepTitle}>Visit review queue</h3>
              <BrowserFrame>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-primary-dark)' }}>
                    Visit review
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      fontSize: '0.5rem',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      padding: '2px 5px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16a34a' }} aria-hidden="true" />
                    Cookie session
                  </span>
                </div>
                {/* Verified row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px',
                    backgroundColor: '#f0fdf4',
                    borderLeft: '3px solid #16a34a',
                    borderRadius: '4px',
                    marginBottom: '5px',
                    fontSize: '0.55rem',
                  }}
                >
                  <span
                    style={{
                      backgroundColor: '#16a34a',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '0.45rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Verified
                  </span>
                  <div style={{ flex: 1, color: 'var(--color-primary-dark)', lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 700 }}>Mrs. K. Anders</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>9:02 → 11:58 · 2.93 hrs billable</div>
                  </div>
                </div>
                {/* Flagged row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px',
                    backgroundColor: '#fefce8',
                    borderLeft: '3px solid #ca8a04',
                    borderRadius: '4px',
                    fontSize: '0.55rem',
                  }}
                >
                  <span
                    style={{
                      backgroundColor: '#ca8a04',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '0.45rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Flagged
                  </span>
                  <div style={{ flex: 1, color: 'var(--color-primary-dark)', lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 700 }}>Mr. R. Patel</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Late clock-out · exception filed</div>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 6px',
                      fontWeight: 800,
                      fontSize: '0.5rem',
                      letterSpacing: '0.3px',
                      cursor: 'default',
                    }}
                  >
                    Approve
                  </button>
                </div>
              </BrowserFrame>
            </div>

            <FlowChevron direction="right" />
            <div className="rayhealth-flow-chevron-down" style={{ justifyContent: 'center' }}>
              <FlowChevron direction="down" />
            </div>

            {/* STEP 4 — State aggregator export */}
            <div className="rayhealth-flow-card" style={flowCardBase}>
              <div style={stepLabel}>Step 4 · Export</div>
              <h3 style={stepTitle}>State aggregator file</h3>
              <div
                style={{
                  position: 'relative',
                  border: '1px solid #c9d8e8',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                }}
              >
                {/* File header with corner-fold */}
                <div
                  style={{
                    position: 'relative',
                    backgroundColor: 'var(--color-primary-dark)',
                    color: 'white',
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '14px',
                      backgroundColor: 'white',
                      borderRadius: '2px',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.6rem', letterSpacing: '0.3px' }}>
                    PA-EVV-export-2026-05-15.csv
                  </span>
                </div>
                {/* Rows */}
                <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.5rem', color: 'var(--color-text-muted)' }}>
                  <div><span style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>caregiver:</span> 8f3a...</div>
                  <div><span style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>medicaid:</span> PA-MA-•••5432</div>
                  <div><span style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>service:</span> W1793</div>
                  <div><span style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>clock-in:</span> 09:02:17</div>
                  <div><span style={{ color: 'var(--color-primary-dark)', fontWeight: 700 }}>lat/long:</span> 40.43°N, -79.99°W</div>
                </div>
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.3, marginTop: 'auto' }}>
                Sandata-aligned · 6/6 federal EVV elements
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div style={card}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
              For caregivers
            </div>
            <h3 style={{ color: 'var(--color-primary-dark)', margin: '0.5rem 0 0.5rem' }}>One-tap, gloves on</h3>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.55, fontSize: '0.95rem' }}>
              Tap clock-in. Phone vibrates within 30 seconds. Done. Works offline; queues + retries when signal returns.
            </p>
          </div>
          <div style={card}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
              For coordinators
            </div>
            <h3 style={{ color: 'var(--color-primary-dark)', margin: '0.5rem 0 0.5rem' }}>One queue per day</h3>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.55, fontSize: '0.95rem' }}>
              Visit Review surfaces every exception with the federal data points alongside. Approve, file, or escalate in one click.
            </p>
          </div>
          <div style={card}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
              For owners
            </div>
            <h3 style={{ color: 'var(--color-primary-dark)', margin: '0.5rem 0 0.5rem' }}>One vendor</h3>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.55, fontSize: '0.95rem' }}>
              EVV, audit trail, billing exports, and payroll runs in the same workflow. Stop reconciling four spreadsheets.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
          <Link
            to="/contact"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              textDecoration: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '1.05rem',
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
              display: 'inline-block'
            }}
          >
            Book a live walkthrough
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
