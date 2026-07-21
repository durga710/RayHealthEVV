import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AgencyMark, PublicBrandStyles } from './public-brand.js';

interface ApplyResponse {
  applicantId: string;
  sessionToken: string;
  message: string;
}

const APPLY_STEPS = [
  { title: 'Tell us about yourself', body: 'Name, contact details, and the role you want — two minutes, no account needed.' },
  { title: 'A short guided interview', body: 'Starts immediately after you submit. No scheduling, no waiting for a call back.' },
  { title: 'Upload your documents', body: 'Your personal portal tracks exactly what’s needed, verified, and pending.' },
];

export function ApplyPage() {
  // Reached either as /apply/:agencyId (direct link) or /<slug>/apply (the
  // agency's public hiring page). The slug variant resolves to an agencyId
  // and also gives us the agency's public name so the page reads as theirs.
  const { agencyId: agencyIdParam, slug } = useParams<{ agencyId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [agencyId, setAgencyId] = useState<string | null>(agencyIdParam ?? null);
  const [agencyName, setAgencyName] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || agencyIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/agency-page/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          if (!cancelled) void navigate('/', { replace: true });
          return;
        }
        const data = (await res.json()) as {
          agencyId: string;
          name: string;
          profile: { displayName?: string } | null;
        };
        if (!cancelled) {
          setAgencyId(data.agencyId);
          setAgencyName(data.profile?.displayName?.trim() || data.name);
        }
      } catch {
        if (!cancelled) void navigate('/', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, agencyIdParam, navigate]);

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
      // Land on the applicant portal: it offers the interview AND the
      // document checklist, and its URL is the applicant's persistent access.
      void navigate(`/applicant/${data.sessionToken}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const teamName = agencyName ?? 'our care team';
  const backPath = slug ? `/${slug}` : '/';

  const field = (
    id: string,
    label: React.ReactNode,
    input: React.ReactNode,
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label htmlFor={id} className="pub-label">
        {label}
      </label>
      {input}
    </div>
  );

  return (
    <div className="pub-root">
      <PublicBrandStyles />

      <nav className="pub-nav" aria-label="Main">
        <Link to={backPath} className="pub-nav-name">
          <AgencyMark size={30} />
          <span>{agencyName ?? 'Caregiver application'}</span>
        </Link>
        <div className="pub-nav-links">
          <Link to={backPath} className="pub-nav-link">← Back {agencyName ? `to ${agencyName}` : 'home'}</Link>
        </div>
      </nav>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'clamp(2rem, 5vw, 4rem)',
          alignItems: 'start',
          maxWidth: 1160,
          margin: '0 auto',
          padding: 'clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 3rem)',
        }}
      >
        {/* Pitch panel */}
        <aside>
          <p className="pub-eyebrow">Careers · {agencyName ?? 'Home care'}</p>
          <h1 className="pub-display" style={{ fontSize: 'clamp(2rem, 4.2vw, 3rem)' }}>
            Join <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--pub-brand)' }}>{teamName}</em>.
          </h1>
          <p className="pub-lede" style={{ marginTop: '1.2rem', maxWidth: '30rem' }}>
            Do work that matters, close to home. Apply in minutes and start your guided
            interview right away — our team reviews every application personally.
          </p>

          <ol style={{ listStyle: 'none', padding: 0, margin: '2.2rem 0 0', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
            {APPLY_STEPS.map((s, i) => (
              <li key={s.title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <span className="pub-careers-num" style={{ color: 'var(--pub-brand)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <b style={{ display: 'block', marginBottom: '0.25rem' }}>{s.title}</b>
                  <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--pub-body-c)' }}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p style={{ marginTop: '2.4rem', fontSize: '0.76rem', color: 'var(--pub-faint)', letterSpacing: '0.04em' }}>
            Pennsylvania · Direct care employment · Hiring powered by RayHealthEVV™
          </p>
        </aside>

        {/* Form panel */}
        <main className="pub-panel">
          <h2 className="pub-display" style={{ fontSize: '1.55rem', marginBottom: '0.4rem' }}>
            Apply now
          </h2>
          <p style={{ margin: '0 0 1.6rem', color: 'var(--pub-body-c)', fontSize: '0.93rem' }}>
            Fill in your details to get started.
          </p>

          {error && (
            <div role="alert" className="pub-alert" style={{ marginBottom: '1.2rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.05rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {field('firstName', 'First name', (
                <input id="firstName" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={100} className="pub-input" />
              ))}
              {field('lastName', 'Last name', (
                <input id="lastName" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={100} className="pub-input" />
              ))}
            </div>

            {field('email', 'Email', (
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} className="pub-input" />
            ))}

            {field('phone', <>Phone <small>(optional)</small></>, (
              <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className="pub-input" />
            ))}

            {field('position', 'Position', (
              <input id="position" type="text" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={100} className="pub-input" />
            ))}

            {field('coverMessage', <>Cover message <small>(optional)</small></>, (
              <textarea
                id="coverMessage"
                value={coverMessage}
                onChange={(e) => setCoverMessage(e.target.value)}
                maxLength={5000}
                rows={4}
                placeholder="Tell us a bit about yourself and why you're interested..."
                className="pub-textarea"
                style={{ resize: 'vertical' }}
              />
            ))}

            <label
              htmlFor="agreeTerms"
              style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.8rem', color: 'var(--pub-body-c)', lineHeight: 1.55, cursor: 'pointer' }}
            >
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: '#96222E', flexShrink: 0 }}
              />
              <span>
                I confirm my information is accurate and I agree to the{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--pub-brand)', fontWeight: 700, textDecoration: 'none' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" style={{ color: 'var(--pub-brand)', fontWeight: 700, textDecoration: 'none' }}>Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="pub-btn pub-btn-primary"
              style={{ width: '100%', marginTop: '0.3rem', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.75 : 1 }}
            >
              {loading ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
