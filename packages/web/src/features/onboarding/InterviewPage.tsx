import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InterviewState {
  status: string;
  messages: ChatMessage[];
  questionsRemaining: number;
  completed?: boolean;
}

interface MessageResponse {
  message: string;
  completed: boolean;
  questionsRemaining: number;
}

const TOTAL_QUESTIONS = 8;

export function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [questionsRemaining, setQuestionsRemaining] = useState(TOTAL_QUESTIONS);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/onboarding/interview/${token}`);
        if (!res.ok) {
          setError('Interview not found or the link has expired.');
          setLoading(false);
          return;
        }
        const data = (await res.json()) as InterviewState;
        setMessages(data.messages ?? []);
        setQuestionsRemaining(data.questionsRemaining ?? TOTAL_QUESTIONS);
        if (data.completed || data.status === 'completed') {
          setCompleted(true);
        }
      } catch {
        setError('Could not load the interview. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || completed) return;

    setSending(true);
    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await fetch(`/api/onboarding/interview/${token ?? ''}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        let msg = 'Could not send your message. Please try again.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) msg = body.message;
        } catch {
          // ignore
        }
        setMessages((prev) => prev.slice(0, -1));
        setError(msg);
        return;
      }

      const data = (await res.json()) as MessageResponse;
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      setQuestionsRemaining(data.questionsRemaining);
      if (data.completed) {
        setCompleted(true);
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setError('Network error. Please check your connection.');
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const questionNumber = Math.min(userMessageCount + 1, TOTAL_QUESTIONS);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
        }}
      >
        <p style={{ color: '#64748B', fontSize: '1rem' }}>Loading interview…</p>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          gap: '1rem',
          padding: '2rem',
        }}
      >
        <p style={{ color: '#BE123C', fontSize: '1rem', textAlign: 'center' }}>{error}</p>
        <Link to="/" style={{ color: '#6366F1', fontSize: '0.875rem' }}>
          Return home
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: '#0F172A',
          color: 'white',
          padding: '0.875rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            RayHealth
          </span>
          <span
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.6rem',
              letterSpacing: '0.12em',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            EVV
          </span>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#94A3B8' }}>
            Caregiver Interview
          </span>
        </div>

        {!completed && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              Question {questionNumber} of {TOTAL_QUESTIONS}
            </span>
            <div
              style={{
                width: '80px',
                height: '4px',
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (userMessageCount / TOTAL_QUESTIONS) * 100)}%`,
                  backgroundColor: '#6366F1',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Chat area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '720px',
          width: '100%',
          margin: '0 auto',
          paddingBottom: completed ? '1.5rem' : '0',
        }}
      >
        {messages.length === 0 && !completed && (
          <div
            style={{
              textAlign: 'center',
              color: '#64748B',
              fontSize: '0.9rem',
              padding: '2rem 0',
            }}
          >
            <p>Welcome! Type your first message to begin the interview.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94A3B8' }}>
              Press Enter to send, Shift+Enter for a new line.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '0.7rem 1rem',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                backgroundColor: m.role === 'user' ? '#4F46E5' : 'white',
                color: m.role === 'user' ? 'white' : '#0F172A',
                fontSize: '0.9375rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: m.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
                boxShadow:
                  m.role === 'assistant'
                    ? '0 1px 3px rgba(0,0,0,0.06)'
                    : '0 1px 3px rgba(79,70,229,0.2)',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '16px 16px 16px 4px',
                backgroundColor: 'white',
                border: '1px solid #E2E8F0',
                color: '#94A3B8',
                fontSize: '0.875rem',
              }}
            >
              Thinking…
            </div>
          </div>
        )}

        {error && messages.length > 0 && (
          <div
            role="alert"
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#FFF1F2',
              color: '#BE123C',
              fontSize: '0.875rem',
              border: '1px solid #FECDD3',
            }}
          >
            {error}
          </div>
        )}

        {completed && (
          <div
            style={{
              marginTop: '1rem',
              padding: '2rem',
              borderRadius: '16px',
              backgroundColor: 'white',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99,102,241,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#0F172A',
                letterSpacing: '-0.01em',
              }}
            >
              Interview Complete!
            </h2>
            <p
              style={{
                margin: 0,
                color: '#475569',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                maxWidth: '380px',
              }}
            >
              Thank you for completing your interview. Our team will review your responses and reach
              out to you soon. Have a great day!
            </p>
          </div>
        )}
      </div>

      {/* Input area */}
      {!completed && (
        <div
          style={{
            borderTop: '1px solid #E2E8F0',
            backgroundColor: 'white',
            padding: '0.875rem 1.5rem',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-end',
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={sending}
              placeholder="Type your answer here… (Enter to send)"
              maxLength={2000}
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid #CBD5E1',
                borderRadius: '10px',
                padding: '0.625rem 0.875rem',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                color: '#0F172A',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              style={{
                flexShrink: 0,
                backgroundColor: sending || !input.trim() ? '#CBD5E1' : '#4F46E5',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.625rem 1.25rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s',
                height: '42px',
              }}
            >
              Send
            </button>
          </div>
          <div
            style={{
              maxWidth: '720px',
              margin: '0.4rem auto 0',
              fontSize: '0.75rem',
              color: '#94A3B8',
              textAlign: 'right',
            }}
          >
            {questionsRemaining > 0
              ? `${questionsRemaining} question${questionsRemaining !== 1 ? 's' : ''} remaining`
              : 'Last question'}
          </div>
        </div>
      )}
    </div>
  );
}
