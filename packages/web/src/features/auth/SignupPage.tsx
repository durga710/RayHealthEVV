import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';

const steps = ['Agency info', 'Admin account'];

export function SignupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) { setError('Agency name is required'); return; }
    setError('');
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyName: agencyName.trim(), state: 'PA', adminEmail: email, password }),
      });
      const data: { message?: string } = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Signup failed');
        return;
      }
      await login(email, password);
      navigate('/admin');
    } catch {
      setError('Signup failed. Please try again.');
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
      {/* Brand panel */}
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
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-20%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(124, 58, 237,0.18) 0%, transparent 70%)',
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
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
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
          <h1 style={{ fontSize: '2.5rem', lineHeight: 1.1, margin: 0, color: 'white', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Start verifying visits in minutes.
          </h1>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: '1rem', lineHeight: 1.6 }}>
            Create your agency account and get access to scheduling, EVV clock-in/out, and Sandata-ready exports &mdash; built for Pennsylvania Personal Assistance agencies.
          </p>
          {['No setup fee &mdash; cancel any time.', 'PA DHS & 21st Century Cures Act compliant.', 'HIPAA-aware infrastructure, ready on day one.'].map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.5 }}>
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span dangerouslySetInnerHTML={{ __html: p }} />
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', fontSize: '0.75rem', color: '#64748B', letterSpacing: '0.04em' }}>
          Pennsylvania-only &middot; HIPAA-aware &middot; 21st Century Cures Act compliant
        </div>
      </aside>

      {/* Form panel */}
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', backgroundColor: 'white' }}>
        <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {steps.map((label, i) => (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                      backgroundColor: i <= step ? '#7c3aed' : '#E2E8F0',
                      color: i <= step ? 'white' : '#94A3B8',
                    }}
                  >
                    {i < step ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: i === step ? '#0F172A' : '#94A3B8', fontWeight: i === step ? 600 : 400 }}>{label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 1, backgroundColor: i < step ? '#7c3aed' : '#E2E8F0' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {step === 0 ? 'Create your agency' : 'Admin account'}
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem' }}>
              {step === 0 ? 'Start by naming your Pennsylvania home care agency.' : 'Set up the first admin login for your agency.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="info-banner banner-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 0 ? (
            <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="agencyName" className="label">Agency name</label>
                <input
                  id="agencyName"
                  type="text"
                  autoComplete="organization"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="Sunrise Home Care LLC"
                  required
                  className="input-field"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label className="label">State</label>
                <div className="input-field" style={{ color: '#64748B', userSelect: 'none' }}>Pennsylvania (PA)</div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontWeight: 600, marginTop: '0.5rem', fontSize: '0.9375rem' }}>
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  required
                  className="input-field"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="confirm" className="label">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="input-field"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(0); }}
                  style={{
                    flex: 1, padding: '0.75rem', fontWeight: 600, fontSize: '0.9375rem',
                    border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer',
                    backgroundColor: 'white', color: '#0F172A',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ flex: 2, padding: '0.75rem', fontWeight: 600, fontSize: '0.9375rem', cursor: loading ? 'wait' : 'pointer' }}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </div>
            </form>
          )}

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748B' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#7c3aed', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
