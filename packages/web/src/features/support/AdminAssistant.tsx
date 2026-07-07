import React, { useEffect, useRef, useState } from 'react';
import { postJson } from '../../lib/api-client.js';

const SESSION_KEY = 'rayhealth_admin_assistant_session';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const greeting: ChatMessage = {
  role: 'assistant',
  content:
    "Hi. I'm RayHealthOps. I can answer operational questions about your agency: visit counts, open exceptions, expiring credentials, and so on. What would you like to look at?"
};

const SUGGESTIONS = [
  'How many visits last week?',
  'Open exceptions by type',
  'Credentials expiring in 30 days',
  'Quick overview of my agency'
];

export function AdminAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useRef<string>(
    (typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_KEY)) || ''
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    if (!override) setInput('');
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ sessionId: string; message: string }>(
        '/api/admin-assistant/chat',
        {
          sessionId: sessionId.current || undefined,
          messages: next.filter((_, i) => !(i === 0 && next[0].role === 'assistant'))
        }
      );
      sessionId.current = data.sessionId;
      try {
        window.sessionStorage.setItem(SESSION_KEY, data.sessionId);
      } catch {
        /* sessionStorage unavailable */
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err) {
      setError((err as Error).message || 'Could not reach the assistant.');
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        style={{
          position: 'fixed',
          right: '1.5rem',
          bottom: '1.5rem',
          zIndex: 1000,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'var(--color-accent, #f97316)',
          color: 'white',
          fontSize: '1.5rem',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(249, 115, 22, 0.35)'
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="RayHealthOps admin assistant"
          style={{
            position: 'fixed',
            right: '1.5rem',
            bottom: '5.5rem',
            zIndex: 1000,
            width: 'min(420px, calc(100vw - 3rem))',
            height: 'min(620px, calc(100vh - 8rem))',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(26, 95, 168, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--color-primary-dark, #0f3a66)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 800 }}>RayHealthOps</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: 'auto' }}>
              your agency · read-only
            </span>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '12px',
                  backgroundColor:
                    m.role === 'user' ? 'var(--color-primary-light, #1a5fa8)' : 'white',
                  color: m.role === 'user' ? 'white' : '#0f172a',
                  border: m.role === 'assistant' ? '1px solid #e3eaf2' : 'none',
                  fontSize: '0.92rem',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: '0.85rem' }}>
                Looking that up…
              </div>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  alignSelf: 'stretch',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  color: '#991b1b',
                  fontSize: '0.85rem'
                }}
              >
                {error}
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div
              style={{
                padding: '0.5rem 0.75rem 0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem'
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={busy}
                  style={{
                    fontSize: '0.75rem',
                    backgroundColor: '#eef2f7',
                    color: '#0f3a66',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '0.3rem 0.7rem',
                    cursor: busy ? 'wait' : 'pointer'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '0.75rem', borderTop: '1px solid #e3eaf2', backgroundColor: 'white' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={busy}
              placeholder="Ask about visits, exceptions, credentials, agency overview…"
              maxLength={2000}
              rows={2}
              style={{
                width: '100%',
                resize: 'none',
                border: '1px solid #c9d8e8',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.9rem',
                fontFamily: 'inherit'
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.5rem'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Read-only · scoped to your agency · Enter to send
              </div>
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || input.trim().length === 0}
                style={{
                  backgroundColor: 'var(--color-accent, #f97316)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: busy || !input.trim() ? 0.5 : 1
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
