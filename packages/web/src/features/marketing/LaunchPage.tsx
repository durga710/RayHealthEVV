import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingShell } from './MarketingShell.js';

const liveItems = [
  'Scheduling operations for recurring visits and service coverage',
  'Care plans and PA-coded tasks that the caregiver will actually read',
  'EVV with GPS-verified clock events and exception review before billing',
  '21st Cures Act-ready data capture (all six federal elements)',
  'Mobile field app with 30-second haptic clock-in and offline retry',
  'Audit-grade trail with append-only event log and column-level encryption'
];

const roadmapItems = [
  'Billing readiness — claim-blocker detection before submission',
  'Payroll readiness — pay-period approvals, exports, authorized provider handoff',
  'Quality assurance — audits, corrective actions, documentation review',
  'RayHealthEVV™ Academy — caregiver lessons, quizzes, certificate renewals',
  'Family portal — calm, real-time visibility, no alarm-bell alerts'
];

const sectionHeading: React.CSSProperties = {
  color: 'var(--color-primary-dark)',
  fontSize: '1.6rem',
  marginTop: '2.5rem',
  marginBottom: '1rem'
};

const lead: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  lineHeight: 1.7,
  fontSize: '1.05rem'
};

const tagPill: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#eef2f7',
  color: 'var(--color-primary-dark)',
  padding: '0.15rem 0.55rem',
  borderRadius: '999px',
  fontSize: '0.7rem',
  fontWeight: 800,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  marginLeft: '0.5rem'
};

export function LaunchPage() {
  return (
    <MarketingShell
      eyebrow="Launch"
      title="RayHealthEVV™ is live — care, finally on the same page."
    >
      <article style={{ maxWidth: '760px', margin: '2rem auto 0' }}>
        <p style={lead}>
          Today we're launching <strong>RayHealthEVV™</strong> — an operations-grade home care platform that
          brings scheduling, EVV, billing readiness, payroll, caregiver training, and family visibility into
          one calm workspace.
        </p>

        <h2 style={sectionHeading}>Why we built it</h2>
        <p style={lead}>
          Home care agencies are juggling more than they should. Schedules in one tab. EVV in another. Billing
          in a spreadsheet. Payroll in a folder of email exports. Caregivers stuck doing real care while
          paperwork piles up between visits.
        </p>
        <p style={lead}>
          We didn't want to bolt one more dashboard onto that pile. We wanted a platform that takes the
          operations of running a home care agency seriously — without taking the humanity out of it.
        </p>

        <h2 style={sectionHeading}>What's live today</h2>
        <ul style={{ ...lead, paddingLeft: '1.25rem' }}>
          {liveItems.map((line) => (
            <li key={line} style={{ marginBottom: '0.4rem' }}>{line}</li>
          ))}
        </ul>

        <h2 style={sectionHeading}>What's on the immediate roadmap</h2>
        <p style={lead}>
          We're shipping the launch narrative whole, but only the items above run in production today.
          Everything below is committed against the next two release cycles. We'd rather tell you straight
          than over-claim:
        </p>
        <ul style={{ ...lead, paddingLeft: '1.25rem' }}>
          {roadmapItems.map((line) => (
            <li key={line} style={{ marginBottom: '0.4rem' }}>
              {line}
              <span style={tagPill}>Roadmap</span>
            </li>
          ))}
        </ul>

        <h2 style={sectionHeading}>Built audit-ready</h2>
        <p style={lead}>
          Every visit is GPS-verified. Every clock event is timestamped and append-only. Every PHI access
          lands in a tamper-resistant audit_events row. State-aggregator export work (Sandata, HHAeXchange) is
          in flight against the existing Cures-Act data model. RayHealthEVV™ is{' '}
          <strong>21st Cures Act-ready by design</strong>, not as a quarterly scramble.
        </p>

        <h2 style={sectionHeading}>Built for the people doing the work</h2>
        <p style={lead}>
          The caregiver app gets out of the way. One tap to clock in. Care plan ready. Tasks one-hand simple.
          Less paperwork. More presence.
        </p>

        <h2 style={sectionHeading}>Get started</h2>
        <ul style={{ ...lead, paddingLeft: '1.25rem' }}>
          <li>
            <strong>Agency owners and operators</strong> —{' '}
            <Link to="/contact">book a demo</Link> and we'll walk you through the live workflow on real data.
          </li>
          <li><strong>Caregivers</strong> — your agency can invite you in once they're set up.</li>
          <li>
            <strong>Families</strong> — a portal experience is on the immediate roadmap; submit the contact
            form to be notified when it ships.
          </li>
        </ul>

        <p
          style={{
            ...lead,
            marginTop: '2rem',
            fontSize: '1.1rem',
            color: 'var(--color-primary-dark)',
            fontWeight: 600
          }}
        >
          Welcome to RayHealthEVV™. Care, finally on the same page.
        </p>

        <div
          style={{
            marginTop: '2.5rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          <Link
            to="/contact"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              textDecoration: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
            }}
          >
            Book an agency demo
          </Link>
          <Link
            to="/pricing"
            style={{
              backgroundColor: 'white',
              color: 'var(--color-primary-dark)',
              border: '2px solid #c9d8e8',
              textDecoration: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontWeight: 700
            }}
          >
            See pricing
          </Link>
        </div>
      </article>
    </MarketingShell>
  );
}
