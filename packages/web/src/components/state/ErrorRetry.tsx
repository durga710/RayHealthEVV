import React from 'react';

interface ErrorRetryProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorRetry({ message, onRetry }: ErrorRetryProps) {
  return (
    <div
      role="alert"
      style={{
        padding: '2rem 1.5rem',
        backgroundColor: '#FFF1F2',
        border: '1px solid #FECDD3',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '0.6rem',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: 'rgba(244, 63, 94, 0.12)',
          color: '#BE123C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(244, 63, 94, 0.25)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h4 style={{ margin: 0, color: '#BE123C', fontSize: '0.9375rem', fontWeight: 600 }}>
        Couldn&apos;t load
      </h4>
      <p style={{ margin: 0, color: '#9F1239', maxWidth: '36ch', fontSize: '0.8125rem', lineHeight: 1.5 }}>
        {message ?? 'Something went wrong while loading this list. Please try again.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: '0.5rem',
          backgroundColor: '#7c3aed',
          color: 'white',
          border: '1px solid #7c3aed',
          padding: '0.5rem 1.1rem',
          borderRadius: '8px',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
        }}
      >
        Retry
      </button>
    </div>
  );
}
