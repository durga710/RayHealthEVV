import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingShell } from './MarketingShell.js';

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '1.75rem',
  boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)'
};

export function DemoPage() {
  return (
    <MarketingShell eyebrow="Demo" title="See a real visit, end-to-end, in two minutes.">
      <div
        style={{
          maxWidth: '960px',
          margin: '2rem auto 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
      >
        {/* Video placeholder. When the Loom / YouTube URL is ready, replace
            the inner div with: <iframe src="..." allow="..." style={...} />. */}
        <div
          style={{
            position: 'relative',
            paddingBottom: '56.25%',
            backgroundColor: 'var(--color-primary-dark)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 6px 20px rgba(26, 95, 168, 0.15)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              gap: '0.5rem',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '4rem' }}>▶</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>Walkthrough video coming soon</div>
            <div style={{ color: '#c9d8e8', maxWidth: '480px', lineHeight: 1.5 }}>
              Two-minute screen capture: caregiver clock-in → 30-second haptic
              confirmation → coordinator visit review → state aggregator export.
            </div>
          </div>
        </div>

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
