import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';

const trustPoints = [
  'Server-managed sessions in HttpOnly cookies — no JWTs in browser storage.',
  'Double-submit CSRF tokens on every state-changing request.',
  'Every login, logout, and CSRF failure is recorded in audit_events.',
  'Mobile access tokens live in expo-secure-store, never plain JS.',
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const returnTo = searchParams.get('returnTo');
      navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Brand panel */}
      <aside
        style={{
          backgroundColor: 'var(--color-primary-dark)',
          color: 'white',
          padding: '3rem 3.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundImage:
            'radial-gradient(circle at 12% 18%, rgba(249,115,22,0.12), transparent 38%), radial-gradient(circle at 85% 80%, rgba(56,134,213,0.18), transparent 42%)',
        }}
      >
        <div>
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              color: 'white',
              fontFamily: 'var(--font-heading)',
              fontWeight: 900,
              fontSize: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            RayHealth
            <span
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                letterSpacing: '2px',
                fontWeight: 800,
              }}
            >
              EVV
            </span>
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '460px' }}>
          <div
            style={{
              fontSize: '0.75rem',
              letterSpacing: '3px',
              fontWeight: 700,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
            }}
          >
            Hardened admin portal
          </div>
          <h1 style={{ fontSize: '2.5rem', lineHeight: 1.15, margin: 0, color: 'white' }}>
            Sign in to the verified care platform.
          </h1>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {trustPoints.map((point) => (
              <li
                key={point}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  color: '#cfe1f7',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    marginTop: '0.35rem',
                    width: '8px',
                    height: '8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-accent)',
                    boxShadow: '0 0 0 4px rgba(249,115,22,0.18)',
                  }}
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
          Pennsylvania-only · HIPAA-aware · 21st Century Cures Act compliant
        </div>
      </aside>

      {/* Form panel */}
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 20px 50px rgba(26, 95, 168, 0.10)',
            border: '1px solid rgba(201, 216, 232, 0.5)',
          }}
        >
          <div style={{ marginBottom: '1.75rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#15803d',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                padding: '0.3rem 0.7rem',
                borderRadius: '999px',
                marginBottom: '1rem',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '999px',
                  backgroundColor: '#16a34a',
                  boxShadow: '0 0 0 3px rgba(22,163,74,0.2)',
                }}
              />
              Cookie session active
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.875rem',
                color: 'var(--color-primary-dark)',
                lineHeight: 1.2,
              }}
            >
              Welcome back.
            </h2>
            <p
              style={{
                margin: '0.5rem 0 0',
                color: 'var(--color-text-muted)',
                fontSize: '0.95rem',
              }}
            >
              Sign in to coordinate care, review visits, and clear exceptions.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: '#b91c1c',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label htmlFor="email" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
              Email
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@your-agency.example"
                required
                style={{ fontWeight: 400 }}
              />
            </label>
            <label htmlFor="password" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
              Password
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ fontWeight: 400 }}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 6px 18px rgba(249,115,22,0.28)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p
            style={{
              marginTop: '1.5rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              textAlign: 'center',
            }}
          >
            Need access? <Link to="/" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>Talk to your agency admin.</Link>
          </p>

          {/* Trust footer — links to public HIPAA compliance page. */}
          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'center' }}>
            <Link
              to="/compliance/hipaa"
              aria-label="HIPAA-compliant — view our control documentation"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#15803d',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: '0.3rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                }}
              />
              HIPAA-COMPLIANT
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
