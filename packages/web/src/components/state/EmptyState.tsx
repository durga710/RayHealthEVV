import React from 'react';
import { Link } from 'react-router-dom';

interface CTA {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  title: string;
  body?: string;
  cta?: CTA;
}

export function EmptyState({ title, body, cta }: EmptyStateProps) {
  const cardStyle: React.CSSProperties = {
    padding: '3rem 1.5rem',
    textAlign: 'center',
    backgroundColor: 'white',
    border: '1px dashed #CBD5E1',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.85rem',
  };

  const iconStyle: React.CSSProperties = {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94A3B8',
    border: '1px solid #E2E8F0',
  };

  const ctaStyle: React.CSSProperties = {
    marginTop: '0.75rem',
    backgroundColor: '#7c3aed',
    color: 'white',
    border: '1px solid #7c3aed',
    padding: '0.55rem 1.1rem',
    borderRadius: '8px',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '0.875rem',
    display: 'inline-block',
    fontFamily: 'inherit',
  };

  return (
    <div style={cardStyle} role="status">
      <div aria-hidden="true" style={iconStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <h4 style={{ margin: 0, color: '#0F172A', fontSize: '0.9375rem', fontWeight: 600 }}>{title}</h4>
      {body && (
        <p style={{ margin: 0, color: '#64748B', maxWidth: '36ch', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          {body}
        </p>
      )}
      {cta && cta.to && (
        <Link to={cta.to} style={ctaStyle}>
          {cta.label}
        </Link>
      )}
      {cta && !cta.to && (
        <button type="button" onClick={cta.onClick} style={ctaStyle}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
