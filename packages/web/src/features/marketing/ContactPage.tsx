import React, { useState } from 'react';
import { MarketingShell } from './MarketingShell.js';

const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: '8px',
  border: '1px solid #c9d8e8',
  fontSize: '1rem',
  fontFamily: 'inherit',
  backgroundColor: 'white'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 700,
  marginBottom: '0.4rem',
  color: 'var(--color-primary-dark)',
  fontSize: '0.9rem'
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
        body: JSON.stringify({ name, email, agency, message })
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
    <MarketingShell eyebrow="Contact" title="Tell us about your agency.">
      <div
        style={{
          maxWidth: '640px',
          margin: '2rem auto 0',
          backgroundColor: 'white',
          padding: '2.5rem',
          borderRadius: '16px',
          boxShadow: '0 6px 20px rgba(26, 95, 168, 0.08)'
        }}
      >
        {status === 'ok' ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h2 style={{ color: 'var(--color-primary-dark)', margin: 0 }}>Got it.</h2>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.75rem', lineHeight: 1.6 }}>
              We'll be in touch within one business day.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
                maxLength={2000}
                placeholder="Active client count, current EVV vendor (if any), what you're trying to fix..."
              />
            </div>
            {status === 'error' && (
              <div style={{ color: '#b91c1c', fontWeight: 600, padding: '0.5rem' }}>{errorText}</div>
            )}
            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '1.05rem',
                cursor: status === 'submitting' ? 'wait' : 'pointer',
                opacity: status === 'submitting' ? 0.6 : 1,
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
              }}
            >
              {status === 'submitting' ? 'Sending…' : 'Send message'}
            </button>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0, textAlign: 'center' }}>
              We use your contact info only to reply. No marketing spam.
            </p>
          </form>
        )}
      </div>
    </MarketingShell>
  );
}
