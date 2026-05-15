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
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
    backgroundColor: 'var(--color-bg)',
    border: '1px dashed #c9d8e8',
    borderRadius: '12px',
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem'
  };

  const iconStyle: React.CSSProperties = {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background:
      'linear-gradient(135deg, rgba(45,125,210,0.15), rgba(249,115,22,0.15))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-primary-dark)',
    fontSize: '1.5rem',
    fontWeight: 700
  };

  const ctaStyle: React.CSSProperties = {
    marginTop: '0.5rem',
    backgroundColor: 'var(--color-accent)',
    color: 'white',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '0.95rem',
    display: 'inline-block'
  };

  return (
    <div style={cardStyle} role="status">
      <div aria-hidden="true" style={iconStyle}>
        +
      </div>
      <h4 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>{title}</h4>
      {body && (
        <p style={{ margin: 0, color: 'var(--color-text-muted)', maxWidth: '32ch' }}>
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
