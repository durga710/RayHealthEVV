import React, { useState } from 'react';
import { SiteLayout, mkic } from './SiteLayout.js';

/**
 * Contact, rebuilt on the shared SiteLayout (teal/orange brand). Preserves
 * the original POST to /api/marketing/contact; restyled with brand tokens
 * (no leftover blue borders/shadows).
 */

const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 0.9rem',
  borderRadius: 10,
  border: '1px solid var(--line-2)',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  background: 'var(--paper)',
  color: 'var(--ink)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: '0.4rem',
  color: 'var(--ink)',
  fontSize: '0.88rem',
};

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agency, setAgency] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorText('');
    try {
      const res = await fetch(`${API_BASE}/marketing/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, agency, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed: ${res.status}`);
      }
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setErrorText(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Contact</span>
          <h1 className="mk-h1">Tell us about your agency.</h1>
          <p className="mk-lead">
            A real person from the team replies within one business day, no bot, no drip campaign.
          </p>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap" style={{ maxWidth: 640 }}>
          <div className="mk-card" style={{ padding: '2.25rem' }}>
            {status === 'ok' ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent)', marginBottom: 12 }}>
                  {mkic(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>)}
                </div>
                <h2 className="mk-h2" style={{ marginTop: 0 }}>Got it.</h2>
                <p style={{ color: 'var(--body)', marginTop: 10, lineHeight: 1.6 }}>
                  We'll be in touch within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label htmlFor="ct-name" style={labelStyle}>Your name</label>
                  <input id="ct-name" required type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={120} />
                </div>
                <div>
                  <label htmlFor="ct-email" style={labelStyle}>Work email</label>
                  <input id="ct-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} maxLength={200} />
                </div>
                <div>
                  <label htmlFor="ct-agency" style={labelStyle}>Agency name</label>
                  <input id="ct-agency" required type="text" value={agency} onChange={(e) => setAgency(e.target.value)} style={inputStyle} maxLength={200} />
                </div>
                <div>
                  <label htmlFor="ct-message" style={labelStyle}>How can we help?</label>
                  <textarea
                    id="ct-message"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
                    maxLength={2000}
                    placeholder="Active client count, current EVV vendor (if any), what you're trying to fix..."
                  />
                </div>
                {status === 'error' && (
                  <div style={{ color: 'var(--accent2-deep)', fontWeight: 600, fontSize: '.9rem' }}>{errorText}</div>
                )}
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="mk-btn mk-pri"
                  style={{ width: '100%', cursor: status === 'submitting' ? 'wait' : 'pointer', opacity: status === 'submitting' ? 0.6 : 1 }}
                >
                  {status === 'submitting' ? 'Sending…' : 'Send message'}
                </button>
                <p style={{ color: 'var(--mut)', fontSize: '.8rem', margin: 0, textAlign: 'center' }}>
                  We use your contact info only to reply. No marketing spam.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
