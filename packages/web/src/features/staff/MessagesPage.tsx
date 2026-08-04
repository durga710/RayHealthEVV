import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

/**
 * Agency message inbox.
 *
 * One thread per caregiver, newest activity first. This exists so work
 * conversation stops happening on coordinators' personal phones, where it sits
 * outside any retention, audit, or BAA the agency holds.
 */

interface Thread {
  id: string;
  caregiverId: string;
  lastMessageAt: string | null;
  unreadForStaff: number;
}

interface Message {
  id: string;
  senderType: 'staff' | 'caregiver';
  body: string;
  createdAt: string;
}

interface StaffMember {
  id: string;
  email: string;
  role: string;
  /** 'active' for real caregivers; 'pending' rows are unaccepted invites. */
  status: string;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'No messages yet';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [caregivers, setCaregivers] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getJson<{ threads: Thread[] }>('/api/messages'),
      getJson<StaffMember[]>('/api/staff'),
    ])
      .then(([threadData, staffData]) => {
        setThreads(threadData?.threads ?? []);
        setCaregivers((staffData ?? []).filter((s) => s.role === 'caregiver' && s.status !== 'pending'));
      })
      .catch((err: Error) => setError(err.message || 'Failed to load messages'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const openThread = useCallback((caregiverId: string) => {
    setSelected(caregiverId);
    getJson<{ messages: Message[] }>(`/api/messages/${encodeURIComponent(caregiverId)}`)
      .then((data) => {
        setMessages(data?.messages ?? []);
        // Opening clears the unread badge server-side; mirror it here rather
        // than refetching the whole thread list.
        setThreads((prev) =>
          prev.map((t) => (t.caregiverId === caregiverId ? { ...t, unreadForStaff: 0 } : t)),
        );
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      })
      .catch(() => setMessages([]));
  }, []);

  const send = async () => {
    const body = draft.trim();
    if (!body || !selected) return;
    setSending(true);
    try {
      await postJson('/api/messages/staff', { caregiverId: selected, body });
      setDraft('');
      openThread(selected);
      loadThreads();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send that message');
    } finally {
      setSending(false);
    }
  };

  const emailFor = (caregiverId: string) =>
    caregivers.find((c) => c.id === caregiverId)?.email ?? 'Caregiver';

  return (
    <div className="page">
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>Messages</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          One conversation per caregiver. Keeps work conversation inside RayHealth instead of on
          personal phones.
        </p>
      </header>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorRetry message={error} onRetry={loadThreads} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.8125rem' }}>
              Caregivers
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {caregivers.length === 0 ? (
                <div style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  No active caregivers yet.
                </div>
              ) : (
                caregivers.map((c) => {
                  const thread = threads.find((t) => t.caregiverId === c.id);
                  const active = selected === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openThread(c.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', border: 'none',
                        borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
                        padding: '0.6rem 0.8rem',
                        background: active ? 'var(--color-surface-soft)' : 'transparent',
                      }}
                      aria-pressed={active}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.email}
                        </span>
                        {thread && thread.unreadForStaff > 0 ? (
                          <span style={{
                            background: 'var(--color-primary)', color: 'white', borderRadius: 999,
                            fontSize: '0.6875rem', fontWeight: 700, padding: '0.05rem 0.4rem',
                          }}>
                            {thread.unreadForStaff}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {formatWhen(thread?.lastMessageAt ?? null)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
            {!selected ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState title="Pick a caregiver" body="Choose someone on the left to see your conversation." />
              </div>
            ) : (
              <>
                <div style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.875rem' }}>
                  {emailFor(selected)}
                </div>
                <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.9rem', display: 'grid', gap: '0.5rem', maxHeight: 400 }}>
                  {messages.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      No messages yet. Say hello.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderType === 'staff';
                      return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '78%', borderRadius: 10, padding: '0.45rem 0.7rem',
                            background: mine ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: mine ? 'white' : 'var(--color-text)',
                            border: mine ? 'none' : '1px solid var(--color-border)',
                            fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}>
                            {m.body}
                            <div style={{ fontSize: '0.6875rem', opacity: 0.7, textAlign: 'right', marginTop: '0.15rem' }}>
                              {formatWhen(m.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.7rem', borderTop: '1px solid var(--color-border)' }}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message"
                    rows={2}
                    maxLength={4000}
                    className="input-field"
                    style={{ flex: 1, resize: 'vertical', fontSize: '0.875rem' }}
                  />
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={sending || draft.trim().length === 0}
                    onClick={() => void send()}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagesPage;
