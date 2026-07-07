import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface ApplyResponse {
  applicantId: string;
  sessionToken: string;
  message: string;
}

export function ApplyPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('Direct Support Associate');
  const [coverMessage, setCoverMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) {
      setError('Invalid application link.');
      return;
    }
    if (!agreed) {
      setError('You must accept the Terms of Service to apply.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          position: position.trim(),
          coverMessage: coverMessage.trim() || undefined,
          acceptedTerms: true,
        }),
      });

      if (!res.ok) {
        let msg = 'Application failed. Please try again.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) msg = body.message;
        } catch {
          // ignore parse error
        }
        setError(msg);
        return;
      }

      const data = (await res.json()) as ApplyResponse;
      void navigate(`/interview/${data.sessionToken}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
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
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-20%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(16, 116, 128,0.18) 0%, transparent 70%)',
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
              background: 'linear-gradient(135deg, #107480 0%, #7fc7cf 100%)',
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

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
            maxWidth: '480px',
          }}
        >
          <h1
            style={{
              fontSize: '2.25rem',
              lineHeight: 1.1,
              margin: 0,
              color: 'white',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Join our care team.
          </h1>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: '1rem', lineHeight: 1.6 }}>
            Apply to become a Direct Support Associate or Caregiver for a Pennsylvania home care
            agency. After submitting, you&apos;ll complete a short AI-powered interview right away.
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
            {[
              'Complete your application in minutes.',
              'AI interview starts immediately, no scheduling required.',
              'Our team reviews your responses and reaches out soon.',
            ].map((point) => (
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
                  stroke="#107480"
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

        <div
          style={{
            position: 'relative',
            fontSize: '0.75rem',
            color: '#64748B',
            letterSpacing: '0.04em',
          }}
        >
          Pennsylvania &middot; Direct care employment &middot; Powered by RayHealthEVV™
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
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
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
              Apply now
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem' }}>
              Fill in your details to get started.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#FFF1F2',
                border: '1px solid #FECDD3',
                borderRadius: '8px',
                color: '#BE123C',
                fontSize: '0.875rem',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                style={{ flexShrink: 0, marginTop: '1px' }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="firstName" className="label">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={100}
                  className="input-field"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="lastName" className="label">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  maxLength={100}
                  className="input-field"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={200}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="phone" className="label">
                Phone{' '}
                <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="position" className="label">
                Position
              </label>
              <input
                id="position"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                maxLength={100}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="coverMessage" className="label">
                Cover Message{' '}
                <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="coverMessage"
                value={coverMessage}
                onChange={(e) => setCoverMessage(e.target.value)}
                maxLength={5000}
                rows={4}
                placeholder="Tell us a bit about yourself and why you're interested..."
                style={{
                  resize: 'vertical',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.9375rem',
                  fontFamily: 'inherit',
                  color: '#0F172A',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <label
              htmlFor="agreeTerms"
              style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, cursor: 'pointer' }}
            >
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: '2px', width: 16, height: 16, accentColor: '#107480', flexShrink: 0 }}
              />
              <span>
                I confirm my information is accurate and I agree to the{' '}
                <Link to="/terms" target="_blank" style={{ color: '#107480', fontWeight: 600, textDecoration: 'none' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" style={{ color: '#107480', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontWeight: 600,
                marginTop: '0.25rem',
                fontSize: '0.9375rem',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
