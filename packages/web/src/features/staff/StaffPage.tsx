import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface StaffMember {
  id: string;
  email: string;
  role: string;
  status: string;
}

type EmailDeliveryStatus = 'sent' | 'failed' | 'not_configured';

interface CreatedInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  acceptPath: string;
  emailDelivery?: EmailDeliveryStatus;
}

interface ResendResponse {
  id: string;
  email: string;
  emailDelivery: EmailDeliveryStatus;
}

type ResendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'failed'; reason: string };

export function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('caregiver');
  const [message, setMessage] = useState('');
  // Last successfully-created invite. Surfaced prominently so the admin
  // can copy the URL as a fallback when email delivery isn't configured
  // or fails.
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-row resend state — keyed by invite id so multiple rows don't
  // share a single "sending" indicator.
  const [resendState, setResendState] = useState<Record<string, ResendState>>({});

  const loadStaff = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<StaffMember[]>('/api/staff')
      .then(data => setStaff(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load staff'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const focusInvite = () => {
    document.getElementById('email')?.focus();
  };

  const fillSampleData = () => {
    setEmail('caregiver+sample@rayhealth.test');
    setRole('caregiver');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setCreatedInvite(null);
    setCopied(false);
    try {
      const invite = await postJson<CreatedInvite>('/api/invites', { email, role });
      setStaff(prev => [...prev, { id: invite.id, email: invite.email, role: invite.role, status: invite.status }]);
      setCreatedInvite(invite);
      // Different copy depending on whether email delivery actually
      // succeeded. `'sent'` means Resend accepted the message — we
      // celebrate that path. Everything else falls back to the
      // copy-and-share UX, same as before email delivery existed.
      if (invite.emailDelivery === 'sent') {
        setMessage(
          `We've emailed the invitation to ${email}. They'll click the link to set their password. ` +
          `(If they don't get it, copy the link below as a fallback.)`
        );
      } else {
        setMessage(`Invite created for ${email} — copy the link below and share it with them.`);
      }
      setEmail('');
    } catch {
      setMessage('Failed to create invite');
    }
  };

  const handleResend = async (inviteId: string) => {
    setResendState(prev => ({ ...prev, [inviteId]: { status: 'sending' } }));
    try {
      const result = await postJson<ResendResponse>(
        `/api/invites/${encodeURIComponent(inviteId)}/resend-email`,
        {}
      );
      if (result.emailDelivery === 'sent') {
        setResendState(prev => ({ ...prev, [inviteId]: { status: 'sent' } }));
        // Auto-clear after a few seconds so the button is reusable.
        setTimeout(() => {
          setResendState(prev => {
            const next = { ...prev };
            delete next[inviteId];
            return next;
          });
        }, 4000);
      } else if (result.emailDelivery === 'not_configured') {
        setResendState(prev => ({
          ...prev,
          [inviteId]: { status: 'failed', reason: 'Email not configured on server' }
        }));
      } else {
        setResendState(prev => ({
          ...prev,
          [inviteId]: { status: 'failed', reason: 'Send failed — try again later' }
        }));
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Request failed';
      setResendState(prev => ({
        ...prev,
        [inviteId]: { status: 'failed', reason }
      }));
    }
  };

  const inviteUrl = createdInvite
    ? `${window.location.origin}${createdInvite.acceptPath}`
    : '';

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the text input so the user can Cmd-C manually.
      const el = document.getElementById('invite-url') as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <div>
      <h2>Staff Management</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Manage caregivers, coordinators, and invite new staff members.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Invite Staff Member</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button
                type="button"
                onClick={fillSampleData}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  color: 'var(--color-accent)',
                  border: '1px dashed var(--color-accent)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                Dev · Fill with sample data
              </button>
            )}
          </div>
          <form onSubmit={handleInvite} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label htmlFor="email">Email Address</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="staff@example.com"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                <option value="caregiver">Caregiver</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit">Create Invite</button>
          </form>
          {message && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: createdInvite ? '#e0f2fe' : '#fee2e2',
                color: createdInvite ? '#0369a1' : '#991b1b',
                borderRadius: '8px'
              }}
            >
              {message}
            </div>
          )}
          {createdInvite && inviteUrl && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1.25rem',
                border: '1px solid #c9d8e8',
                borderRadius: '8px',
                backgroundColor: '#f8fafc'
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                {createdInvite.emailDelivery === 'sent'
                  ? `Backup link — only needed if ${createdInvite.email} doesn't see the email.`
                  : `Share this link with ${createdInvite.email}. They'll set a password and finish creating their account.`}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input
                  id="invite-url"
                  type="text"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #c9d8e8',
                    borderRadius: '6px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.8125rem',
                    backgroundColor: 'white'
                  }}
                />
                <button type="button" onClick={handleCopy} style={{ whiteSpace: 'nowrap' }}>
                  {copied ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Expires {new Date(createdInvite.expiresAt).toLocaleString()}
                {' · '}
                Single-use — once they accept, the link stops working.
              </div>
            </div>
          )}
        </div>

        <div>
          <h3>Active Staff Directory</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadStaff} />
          ) : staff.length === 0 ? (
            <EmptyState
              title="No staff yet"
              body="Invite a caregiver, coordinator, or admin to start staffing visits."
              cta={{ label: 'Invite a staff member', onClick: focusInvite }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {staff.map(s => {
                const isExpanded = expandedId === s.id;
                const isPending = s.status === 'pending';
                const resend = resendState[s.id] ?? { status: 'idle' as const };
                return (
                  <li
                    key={s.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: isExpanded ? '#f8fafc' : 'white'
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit'
                      }}
                    >
                      <div>
                        <strong>{s.email}</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Role: {s.role}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: s.status === 'pending' ? '#fef3c7' : '#e0f2fe', color: s.status === 'pending' ? '#d97706' : '#0284c7', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {s.status}
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem', minWidth: '1ch', textAlign: 'center' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0 1rem 1rem',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: '0.85rem',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.35rem 1rem',
                          color: '#475569'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>User ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{s.id}</div>
                        <div style={{ fontWeight: 600 }}>Email</div>
                        <div>{s.email}</div>
                        <div style={{ fontWeight: 600 }}>Role</div>
                        <div style={{ textTransform: 'capitalize' }}>{s.role}</div>
                        <div style={{ fontWeight: 600 }}>Status</div>
                        <div style={{ textTransform: 'capitalize' }}>{s.status}</div>
                        {isPending && (
                          <>
                            <div style={{ fontWeight: 600 }}>Actions</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                              <button
                                type="button"
                                onClick={() => handleResend(s.id)}
                                disabled={resend.status === 'sending'}
                                style={{
                                  padding: '0.4rem 0.85rem',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  backgroundColor: resend.status === 'sent' ? '#dcfce7' : '#0b2a4a',
                                  color: resend.status === 'sent' ? '#166534' : '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: resend.status === 'sending' ? 'wait' : 'pointer',
                                  opacity: resend.status === 'sending' ? 0.7 : 1
                                }}
                              >
                                {resend.status === 'sending'
                                  ? 'Resending…'
                                  : resend.status === 'sent'
                                  ? 'Email resent ✓'
                                  : 'Resend email'}
                              </button>
                              {resend.status === 'failed' && (
                                <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>
                                  {resend.reason}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
