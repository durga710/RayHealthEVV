import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingShell } from './MarketingShell.js';

const tiers = [
  {
    name: 'Starter',
    price: '$249',
    period: 'per month',
    summary: 'For new and single-branch agencies under 25 active clients.',
    features: [
      'Up to 25 active clients',
      'Unlimited caregivers',
      'EVV with 30-second haptic clock-in',
      'Audit · Billing · Payroll bundled',
      'PA DHS / PROMISe ready',
      'Email support'
    ],
    cta: 'Start with Starter',
    accent: false
  },
  {
    name: 'Standard',
    price: '$649',
    period: 'per month',
    summary: 'Multi-coordinator agencies with 25–200 active clients.',
    features: [
      'Up to 200 active clients',
      'Unlimited caregivers',
      'Everything in Starter',
      'Sandata / HHAeXchange aggregator export',
      'Visit Review queue + exception workflow',
      'Audit-grade trail with 7-year retention',
      'Phone + Slack support'
    ],
    cta: 'Start with Standard',
    accent: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'annual contract',
    summary: 'Multi-branch and value-based-care contracts at scale.',
    features: [
      '200+ active clients',
      'Multi-branch agency hierarchy',
      'Custom Cures-Act submission profile',
      'Dedicated environment + SLAs',
      'BAA executed; HITRUST-aligned',
      'Named CSM, 30-min P1 response'
    ],
    cta: 'Contact sales',
    accent: false
  }
];

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '2.25rem',
  boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const accentCard: React.CSSProperties = {
  ...card,
  border: '2px solid var(--color-accent)',
  transform: 'scale(1.02)'
};

const ctaButton: React.CSSProperties = {
  marginTop: 'auto',
  display: 'inline-block',
  textAlign: 'center',
  padding: '0.9rem 1.5rem',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '1rem'
};

export function PricingPage() {
  return (
    <MarketingShell
      eyebrow="Pricing"
      title="Predictable per-month pricing. No per-visit nickel-and-diming."
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '2rem auto 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {tiers.map((tier) => (
          <div key={tier.name} style={tier.accent ? accentCard : card}>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color: tier.accent ? 'var(--color-accent)' : 'var(--color-text-muted)'
                }}
              >
                {tier.name}
                {tier.accent ? ' · most popular' : ''}
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--color-primary-dark)', marginTop: '0.5rem' }}>
                {tier.price}
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600, marginLeft: '0.5rem' }}>
                  {tier.period}
                </span>
              </div>
              <p style={{ color: 'var(--color-text-muted)', margin: '0.75rem 0 0', lineHeight: 1.5 }}>{tier.summary}</p>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tier.features.map((f) => (
                <li
                  key={f}
                  style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', paddingLeft: '1.5rem', position: 'relative' }}
                >
                  <span style={{ position: 'absolute', left: 0, top: 0, color: 'var(--color-primary-light)', fontWeight: 800 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/contact"
              style={{
                ...ctaButton,
                backgroundColor: tier.accent ? 'var(--color-accent)' : 'var(--color-primary-light)',
                color: 'white',
                boxShadow: tier.accent ? '0 4px 14px rgba(249, 115, 22, 0.3)' : 'none'
              }}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      <p
        style={{
          maxWidth: '720px',
          margin: '3rem auto 0',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6
        }}
      >
        All plans include the same EVV engine — same federal Cures-Act elements, same PA DHS alignment, same audit trail. The tiers differ only in volume and support.
      </p>
    </MarketingShell>
  );
}
