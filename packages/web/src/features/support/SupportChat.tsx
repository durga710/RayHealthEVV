import React, { useEffect, useRef, useState } from 'react';

const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api';

const SESSION_KEY = 'rayhealth_support_session';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const greeting: ChatMessage = {
  role: 'assistant',
  content:
    "Hi. I'm RayHealthAssist. I can answer questions about EVV, scheduling, pricing, and what ships at launch. What brings you here today?"
};

export function SupportChat() {
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

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/support/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.current || undefined,
          // Skip the local greeting (assistant message at index 0); only
          // send genuine turns to the model.
          messages: next.filter((_, i) => !(i === 0 && next[0].role === 'assistant'))
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Request failed: ${res.status}`);
      }
      const data = (await res.json()) as { sessionId: string; message: string };
      sessionId.current = data.sessionId;
      try {
        window.sessionStorage.setItem(SESSION_KEY, data.sessionId);
      } catch {
        /* sessionStorage may be unavailable in some embeds */
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
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        style={{
          position: 'fixed',
          right: '1.5rem',
          bottom: '1.5rem',
          zIndex: 1000,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'var(--color-primary-light)',
          color: 'white',
          fontSize: '1.5rem',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(26, 95, 168, 0.35)'
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

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="RayHealth support chat"
          style={{
            position: 'fixed',
            right: '1.5rem',
            bottom: '5.5rem',
            zIndex: 1000,
            width: 'min(380px, calc(100vw - 3rem))',
            height: 'min(560px, calc(100vh - 8rem))',
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
              backgroundColor: 'var(--color-primary-dark)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 800 }}>RayHealthAssist</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: 'auto' }}>
              answers about pricing & EVV
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
                  backgroundColor: m.role === 'user' ? 'var(--color-primary-light)' : 'white',
                  color: m.role === 'user' ? 'white' : 'var(--color-text)',
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
              <div style={{ alignSelf: 'flex-start', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                RayHealthAssist is typing…
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

          <div style={{ padding: '0.75rem', borderTop: '1px solid #e3eaf2', backgroundColor: 'white' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={busy}
              placeholder="Ask about EVV, pricing, or how clock-in works…"
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
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                Don't share PHI · Enter to send
              </div>
              <button
                type="button"
                onClick={send}
                disabled={busy || input.trim().length === 0}
                style={{
                  backgroundColor: 'var(--color-accent)',
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
