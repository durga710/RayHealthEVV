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
        marginTop: '1rem',
        padding: '1.5rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '0.5rem'
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700
        }}
      >
        !
      </div>
      <h4 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
        Couldn't load
      </h4>
      <p style={{ margin: 0, color: '#991b1b', maxWidth: '36ch' }}>
        {message ?? 'Something went wrong while loading this list. Please try again.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: '0.5rem',
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          padding: '0.55rem 1.1rem',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.95rem'
        }}
      >
        Retry
      </button>
    </div>
  );
}
