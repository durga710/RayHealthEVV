import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { postJson } from '../../lib/api-client.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await postJson('/api/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2.5rem',
          boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#6366F1',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              marginBottom: '1.5rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to sign in
          </Link>
          <h1
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            Forgot your password?
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem' }}>
            Enter your email and we&rsquo;ll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div
            role="status"
            style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              color: '#166534',
              fontSize: '0.9375rem',
              lineHeight: 1.55,
            }}
          >
            <strong>Check your inbox.</strong> If that email is registered, a reset link is on its way. It expires in 1 hour.
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="info-banner banner-error"
                style={{ marginBottom: '1rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.example"
                  required
                  className="input-field"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
