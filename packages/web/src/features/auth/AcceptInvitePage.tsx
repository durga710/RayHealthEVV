import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

interface InviteInfo {
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  agencyName: string;
  expiresAt: string;
  status: 'pending' | 'expired' | 'revoked' | 'accepted';
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'form'; info: InviteInfo; token: string }
  | { phase: 'success'; role: string };

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>({ phase: 'loading' });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const token = searchParams.get('token') ?? '';

  useEffect(() => {
    if (!token) {
      setPageState({ phase: 'error', message: 'No invite token found in the link. Please check your email and try again.' });
      return;
    }

    fetch(`/api/invites/accept/${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' }
    })
      .then(async (res) => {
        const body = await res.json() as { success?: boolean; data?: InviteInfo; error?: string };
        if (!res.ok || !body.success || !body.data) {
          setPageState({ phase: 'error', message: body.error ?? 'Invite not found.' });
          return;
        }
        const info = body.data;
        if (info.status === 'accepted') {
          setPageState({ phase: 'error', message: 'This invite has already been used. If you need access, ask your agency admin to send a new invite.' });
        } else if (info.status === 'expired') {
          setPageState({ phase: 'error', message: 'This invite has expired. Please ask your agency admin to resend it.' });
        } else if (info.status === 'revoked') {
          setPageState({ phase: 'error', message: 'This invite has been revoked. Please contact your agency admin.' });
        } else {
          setFirstName(info.firstName ?? '');
          setLastName(info.lastName ?? '');
          setPageState({ phase: 'form', info, token });
        }
      })
      .catch(() => {
        setPageState({ phase: 'error', message: 'Could not load invite details. Please check your connection and try again.' });
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 12) {
      setFormError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/accept/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accessCode,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        })
      });

      const body = await res.json() as { success?: boolean; data?: { role: string }; error?: string };

      if (!res.ok || !body.success) {
        setFormError(body.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setPageState({ phase: 'success', role: body.data?.role ?? 'user' });
    } catch {
      setFormError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const brandPanel = (
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
          Set up your care account.
        </h1>
        <p style={{ margin: 0, color: '#CBD5E1', fontSize: '1rem', lineHeight: 1.6 }}>
          You've been invited to join your agency on RayHealth EVV. Create your password to finish setting up your account.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[
            'Your access code is in the invite email.',
            'Password must be at least 12 characters.',
            'This link is single-use and expires after acceptance.',
          ].map((point) => (
            <li
              key={point}
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.5 }}
            >
              <CheckIcon />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ position: 'relative', fontSize: '0.75rem', color: '#64748B', letterSpacing: '0.04em' }}>
        Pennsylvania-only &middot; HIPAA-aware &middot; 21st Century Cures Act compliant
      </div>
    </aside>
  );

  if (pageState.phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', backgroundColor: 'white' }}>
        {brandPanel}
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
          <p style={{ color: '#64748B' }}>Loading invite…</p>
        </main>
      </div>
    );
  }

  if (pageState.phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', backgroundColor: 'white' }}>
        {brandPanel}
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0F172A' }}>Invite unavailable</h2>
            <div role="alert" className="info-banner banner-error">
              {pageState.message}
            </div>
            <Link to="/login" style={{ color: '#6366F1', fontWeight: 500, fontSize: '0.9375rem' }}>
              Go to sign in →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (pageState.phase === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', backgroundColor: 'white' }}>
        {brandPanel}
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1.75rem', alignItems: 'flex-start' }}>
            <div
              aria-hidden
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Account created!
              </h2>
              <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                Your {pageState.role} account is ready. Sign in with your email and the password you just set.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.9375rem' }}
              onClick={() => navigate('/login')}
            >
              Go to sign in
            </button>
          </div>
        </main>
      </div>
    );
  }

  // phase === 'form'
  const { info } = pageState;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', backgroundColor: 'white' }}>
      {brandPanel}
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Create your account
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              Invited to <strong style={{ color: '#0F172A' }}>{info.agencyName}</strong> as <span style={{ textTransform: 'capitalize' }}>{info.role}</span>.
            </p>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.8125rem' }}>{info.email}</p>
          </div>

          {formError && (
            <div role="alert" className="info-banner banner-error">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="firstName" className="label">First name</label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="input-field"
                  placeholder="Jane"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="lastName" className="label">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="input-field"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="phone" className="label">
                Phone <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="(215) 555-0100"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="accessCode" className="label">Access code</label>
              <input
                id="accessCode"
                type="text"
                autoComplete="one-time-code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                className="input-field"
                placeholder="XXXX-XXXX"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Find this in your invite email.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                className="input-field"
                placeholder="At least 12 characters"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="confirmPassword" className="label">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-field"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontWeight: 600, marginTop: '0.5rem', fontSize: '0.9375rem', cursor: submitting ? 'wait' : 'pointer' }}
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem', fontSize: '0.8125rem', color: '#94A3B8' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#6366F1', fontWeight: 500 }}>Sign in</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
