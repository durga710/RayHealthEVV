import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';

const ADMIN_ROLES = new Set(['admin', 'coordinator']);

const trustPoints = [
  'HIPAA-aware infrastructure with HttpOnly cookie sessions.',
  'Double-submit CSRF protection on every state-changing request.',
  'Append-only audit trail — every login, logout, and access is logged.',
];

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordWasReset = searchParams.get('reset') === '1';

  // If the user is already authenticated (e.g. pressing Back from /admin),
  // send them straight to their dashboard instead of showing the login form.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const returnTo = searchParams.get('returnTo');
    if (returnTo && returnTo.startsWith('/') && ADMIN_ROLES.has(user.role)) {
      navigate(returnTo, { replace: true });
    } else if (ADMIN_ROLES.has(user.role)) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/portal', { replace: true });
    }
  }, [isAuthenticated, user, navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { role } = await login(email, password);
      const returnTo = searchParams.get('returnTo');
      // replace: true so /login is never in the back-button history
      if (returnTo && returnTo.startsWith('/') && ADMIN_ROLES.has(role)) {
        navigate(returnTo, { replace: true });
      } else if (ADMIN_ROLES.has(role)) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/portal', { replace: true });
      }
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
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        backgroundColor: 'white',
      }}
    >
      {/* Dark brand panel */}
      <aside
        style={{
          backgroundColor: '#0F172A',
          color: 'white',
          padding: '3rem 4rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle ambient highlight — single soft indigo glow, no dual-color gradient. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-20%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Link
          to="/"
          style={{
            position: 'relative',
            textDecoration: 'none',
            color: 'white',
            fontWeight: 700,
            fontSize: '1.25rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            letterSpacing: '-0.01em',
          }}
        >
          RayHealth
          <span
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: '5px',
              fontSize: '0.65rem',
              letterSpacing: '0.14em',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            EVV
          </span>
        </Link>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '480px' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              lineHeight: 1.1,
              margin: 0,
              color: 'white',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            The verified care platform for Pennsylvania agencies.
          </h1>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: '1rem', lineHeight: 1.6 }}>
            Schedule, verify, and audit every visit &mdash; built around PA DHS Personal Assistance Services and the 21st Century Cures Act.
          </p>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            {trustPoints.map((point) => (
              <li
                key={point}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  color: '#94A3B8',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: '2px' }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ position: 'relative', fontSize: '0.75rem', color: '#64748B', letterSpacing: '0.04em' }}>
          Pennsylvania-only &middot; HIPAA-aware &middot; 21st Century Cures Act compliant
        </div>
      </aside>

      {/* Form panel */}
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          backgroundColor: 'white',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.625rem',
                fontWeight: 700,
                color: '#0F172A',
                letterSpacing: '-0.02em',
              }}
            >
              Sign in
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem' }}>
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          {passwordWasReset && (
            <div
              role="status"
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#166534',
                fontSize: '0.9rem',
              }}
            >
              Password updated. Sign in with your new password.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="info-banner banner-error"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@your-agency.example"
                required
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
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
                marginTop: '0.5rem',
                fontSize: '0.9375rem',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.875rem', color: '#6366F1', fontWeight: 500 }}
              >
                Forgot your password?
              </Link>
            </div>
          </form>

          <div
            style={{
              borderTop: '1px solid #E2E8F0',
              paddingTop: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <Link
              to="/compliance/hipaa"
              aria-label="View HIPAA compliance documentation"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#64748B',
                fontSize: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                textDecoration: 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 12l2 2 4-4" />
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              HIPAA compliance documentation
            </Link>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Need access? <Link to="/" style={{ color: '#6366F1', fontWeight: 500 }}>Contact your agency admin.</Link>
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              New agency?{' '}
              <Link to="/signup" style={{ color: '#6366F1', fontWeight: 500 }}>Create an account.</Link>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
