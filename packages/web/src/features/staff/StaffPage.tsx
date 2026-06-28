import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson, patchJson, deleteJson } from '../../lib/api-client.js';
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
  emailError?: string;
}

type ResendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'failed'; reason: string };

const ROLE_COLORS: Record<string, string> = {
  admin:       '#7c3aed',
  coordinator: '#0EA5E9',
  caregiver:   '#10B981',
  family:      '#F59E0B',
};

function Avatar({ email, active }: { email: string; active: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        width: 28, height: 28, borderRadius: '50%',
        background: active ? 'linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)' : '#E2E8F0',
        color: active ? 'white' : '#64748B',
        display: 'grid', placeItems: 'center',
        fontWeight: 600, fontSize: '0.75rem', flexShrink: 0,
      }}
    >
      {email.charAt(0).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? '#94A3B8';
  return (
    <span style={{
      display: 'inline-block', padding: '0.15em 0.55em', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600,
      background: `${color}18`, color, textTransform: 'capitalize',
    }}>{role}</span>
  );
}

export function StaffPage() {
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Invite form
  const [email, setEmail]               = useState('');
  const [role, setRole]                 = useState('caregiver');
  const [message, setMessage]           = useState('');
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [copied, setCopied]             = useState(false);

  // Per-row action states
  const [expandedId, setExpandedId]  = useState<string | null>(null);
  const [resendState, setResendState] = useState<Record<string, ResendState>>({});
  const [editRole, setEditRole]       = useState<Record<string, string>>({});
  const [savingRole, setSavingRole]   = useState<Record<string, boolean>>({});
  const [removing, setRemoving]       = useState<Record<string, boolean>>({});
  const [revoking, setRevoking]       = useState<Record<string, boolean>>({});
  const [revokingAll, setRevokingAll] = useState(false);

  const loadStaff = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<StaffMember[]>('/api/staff')
      .then(data => setStaff(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load staff'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const focusInvite   = () => document.getElementById('email')?.focus();
  const fillSampleData = () => { setEmail('caregiver+sample@rayhealth.test'); setRole('caregiver'); };

  // ── Create invite ────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(''); setCreatedInvite(null); setCopied(false);
    try {
      const invite = await postJson<CreatedInvite>('/api/invites', { email, role });
      setStaff(prev => [...prev, { id: invite.id, email: invite.email, role: invite.role, status: invite.status }]);
      setCreatedInvite(invite);
      setMessage(invite.emailDelivery === 'sent'
        ? `Invitation emailed to ${email}. Copy the link below as a backup.`
        : `Invite created for ${email} — copy the link below and share it.`);
      setEmail('');
    } catch {
      setMessage('Failed to create invite');
    }
  };

  // ── Resend invite email ───────────────────────────────────────────
  const handleResend = async (inviteId: string) => {
    setResendState(prev => ({ ...prev, [inviteId]: { status: 'sending' } }));
    try {
      const result = await postJson<ResendResponse>(`/api/invites/${encodeURIComponent(inviteId)}/resend-email`, {});
      if (result.emailDelivery === 'sent') {
        setResendState(prev => ({ ...prev, [inviteId]: { status: 'sent' } }));
        setTimeout(() => setResendState(prev => { const n = { ...prev }; delete n[inviteId]; return n; }), 4000);
      } else if (result.emailDelivery === 'not_configured') {
        setResendState(prev => ({ ...prev, [inviteId]: { status: 'failed', reason: 'Email not configured on server' } }));
      } else {
        const reason = result.emailError ? `Send failed: ${result.emailError}` : 'Send failed — try again';
        setResendState(prev => ({ ...prev, [inviteId]: { status: 'failed', reason } }));
      }
    } catch (err) {
      setResendState(prev => ({ ...prev, [inviteId]: { status: 'failed', reason: err instanceof Error ? err.message : 'Request failed' } }));
    }
  };

  // ── Revoke one invite ─────────────────────────────────────────────
  const handleRevokeInvite = async (inviteId: string, inviteEmail: string) => {
    if (!window.confirm(`Revoke the pending invitation for ${inviteEmail}?`)) return;
    setRevoking(prev => ({ ...prev, [inviteId]: true }));
    try {
      await deleteJson(`/api/invites/${encodeURIComponent(inviteId)}`);
      setStaff(prev => prev.filter(s => s.id !== inviteId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke invite');
    } finally {
      setRevoking(prev => { const n = { ...prev }; delete n[inviteId]; return n; });
    }
  };

  // ── Revoke ALL pending invites ────────────────────────────────────
  const handleRevokeAll = async () => {
    const count = pendingInvites.length;
    if (!window.confirm(`Revoke all ${count} pending invitations? This cannot be undone.`)) return;
    setRevokingAll(true);
    try {
      await deleteJson('/api/invites?all=true');
      setStaff(prev => prev.filter(s => s.status !== 'pending'));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke invitations');
    } finally {
      setRevokingAll(false);
    }
  };

  // ── Change role (admin ↔ coordinator only) ────────────────────────
  const handleSaveRole = async (memberId: string) => {
    const newRole = editRole[memberId];
    if (!newRole) return;
    setSavingRole(prev => ({ ...prev, [memberId]: true }));
    try {
      await patchJson(`/api/staff/${encodeURIComponent(memberId)}`, { role: newRole });
      setStaff(prev => prev.map(s => s.id === memberId ? { ...s, role: newRole } : s));
      setEditRole(prev => { const n = { ...prev }; delete n[memberId]; return n; });
      setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSavingRole(prev => { const n = { ...prev }; delete n[memberId]; return n; });
    }
  };

  // ── Remove / deactivate active staff ─────────────────────────────
  const handleRemove = async (member: StaffMember) => {
    const isCaregiver = member.role === 'caregiver';
    const action = isCaregiver ? 'Deactivate' : 'Remove';
    if (!window.confirm(`${action} ${member.email}? This cannot be undone.`)) return;
    setRemoving(prev => ({ ...prev, [member.id]: true }));
    try {
      await deleteJson(`/api/staff/${encodeURIComponent(member.id)}?type=${isCaregiver ? 'caregiver' : 'user'}`);
      setStaff(prev => prev.filter(s => s.id !== member.id));
      setExpandedId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action.toLowerCase()} staff member`);
    } finally {
      setRemoving(prev => { const n = { ...prev }; delete n[member.id]; return n; });
    }
  };

  const inviteUrl  = createdInvite ? `${window.location.origin}${createdInvite.acceptPath}` : '';
  const handleCopy = async () => {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { (document.getElementById('invite-url') as HTMLInputElement | null)?.select(); }
  };

  const activeStaff    = staff.filter(s => s.status === 'active');
  const pendingInvites = staff.filter(s => s.status === 'pending');

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Staff</h1>
          <p style={{ margin: 0, color: '#64748B' }}>Manage caregivers, coordinators, and invite new staff members.</p>
        </div>
        <button type="button" onClick={focusInvite} className="btn-primary">Invite staff</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,380px) minmax(0,1fr)', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left: invite form ── */}
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Invite a staff member</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button type="button" onClick={fillSampleData} className="btn-ghost btn-sm" style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sample data</button>
            )}
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="email" className="label">Email Address</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="staff@example.com" className="input-field" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="role" className="label">Role</label>
              <select id="role" value={role} onChange={e => setRole(e.target.value)} className="select-field">
                <option value="caregiver">Caregiver</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>Create Invite</button>
          </form>

          {message && (
            <div className={`info-banner ${createdInvite ? 'banner-info' : 'banner-error'}`} style={{ marginTop: '1rem' }} role={createdInvite ? 'status' : 'alert'}>
              {message}
            </div>
          )}
          {createdInvite && inviteUrl && (
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                {createdInvite.emailDelivery === 'sent'
                  ? `Backup link — only needed if ${createdInvite.email} doesn't see the email.`
                  : `Share this link with ${createdInvite.email}.`}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input id="invite-url" type="text" readOnly value={inviteUrl} onFocus={e => e.currentTarget.select()} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', backgroundColor: 'white' }} />
                <button type="button" onClick={handleCopy} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>{copied ? 'Copied' : 'Copy link'}</button>
              </div>
              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                Expires {new Date(createdInvite.expiresAt).toLocaleString()} &middot; single-use
              </div>
            </div>
          )}
        </div>

        {/* ── Right: tables ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Active staff */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Active staff directory</h3>
              {!loading && !loadError && activeStaff.length > 0 && (
                <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{activeStaff.length} member{activeStaff.length === 1 ? '' : 's'}</span>
              )}
            </div>
            {loading ? <LoadingSkeleton rows={5} columns={3} /> :
             loadError ? <ErrorRetry message={loadError} onRetry={loadStaff} /> :
             activeStaff.length === 0 ? (
               <EmptyState title="No active staff yet" body="Staff appear here once they accept their invite." cta={{ label: 'Invite a staff member', onClick: focusInvite }} />
             ) : (
               <table className="data-table">
                 <thead>
                   <tr>
                     <th>Email</th>
                     <th>Role</th>
                     <th style={{ width: '40px' }} aria-label="expand" />
                   </tr>
                 </thead>
                 <tbody>
                   {activeStaff.map(s => {
                     const isExpanded  = expandedId === s.id;
                     const pendingRole = editRole[s.id] ?? s.role;
                     const isSaving    = savingRole[s.id] ?? false;
                     const isRemoving  = removing[s.id] ?? false;
                     const isUser      = s.role === 'admin' || s.role === 'coordinator';
                     const roleDirty   = pendingRole !== s.role;
                     return (
                       <React.Fragment key={s.id}>
                         <tr onClick={() => setExpandedId(isExpanded ? null : s.id)} style={{ cursor: 'pointer' }} aria-expanded={isExpanded}>
                           <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                               <Avatar email={s.email} active />
                               <span style={{ fontWeight: 500 }}>{s.email}</span>
                             </div>
                           </td>
                           <td><RoleBadge role={s.role} /></td>
                           <td style={{ color: '#94A3B8' }}>{isExpanded ? '▾' : '▸'}</td>
                         </tr>

                         {isExpanded && (
                           <tr>
                             <td colSpan={3} style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem' }}>
                               <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.25rem', fontSize: '0.8125rem', color: '#475569', marginBottom: '1rem' }}>
                                 <div style={{ fontWeight: 600 }}>User ID</div>
                                 <div style={{ fontFamily: 'var(--font-mono)' }}>{s.id}</div>
                                 <div style={{ fontWeight: 600 }}>Email</div>
                                 <div>{s.email}</div>
                                 <div style={{ fontWeight: 600 }}>Role</div>
                                 <div><RoleBadge role={s.role} /></div>
                               </div>

                               <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                 {isUser && (
                                   <>
                                     <select
                                       value={pendingRole}
                                       onChange={e => setEditRole(prev => ({ ...prev, [s.id]: e.target.value }))}
                                       className="select-field"
                                       style={{ fontSize: '0.8125rem', padding: '0.3rem 0.6rem', minWidth: '130px' }}
                                       aria-label="Change role"
                                     >
                                       <option value="coordinator">Coordinator</option>
                                       <option value="admin">Admin</option>
                                     </select>
                                     <button
                                       type="button"
                                       className="btn-secondary btn-sm"
                                       disabled={!roleDirty || isSaving}
                                       onClick={() => handleSaveRole(s.id)}
                                     >
                                       {isSaving ? 'Saving…' : 'Save role'}
                                     </button>
                                   </>
                                 )}
                                 <button
                                   type="button"
                                   className="btn-ghost btn-sm"
                                   disabled={isRemoving}
                                   onClick={() => handleRemove(s)}
                                   style={{ color: '#BE123C', marginLeft: isUser ? 'auto' : undefined }}
                                 >
                                   {isRemoving
                                     ? (s.role === 'caregiver' ? 'Deactivating…' : 'Removing…')
                                     : (s.role === 'caregiver' ? 'Deactivate caregiver' : 'Remove user')}
                                 </button>
                               </div>
                             </td>
                           </tr>
                         )}
                       </React.Fragment>
                     );
                   })}
                 </tbody>
               </table>
             )}
          </div>

          {/* Pending invitations */}
          {!loading && !loadError && pendingInvites.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>Pending invitations</h3>
                  <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{pendingInvites.length} awaiting acceptance</span>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                  style={{ color: '#BE123C', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {revokingAll ? 'Revoking…' : `Revoke all (${pendingInvites.length})`}
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th style={{ width: '200px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map(s => {
                    const resend    = resendState[s.id] ?? { status: 'idle' as const };
                    const isRevoking = revoking[s.id] ?? false;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar email={s.email} active={false} />
                            <span style={{ fontWeight: 500, color: '#64748B' }}>{s.email}</span>
                          </div>
                        </td>
                        <td><RoleBadge role={s.role} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleResend(s.id)}
                              disabled={resend.status === 'sending'}
                              className={resend.status === 'sent' ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}
                            >
                              {resend.status === 'sending' ? 'Resending…' : resend.status === 'sent' ? (
                                <>
                                  Sent{' '}
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ verticalAlign: 'middle' }}>
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                </>
                              ) : 'Resend'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeInvite(s.id, s.email)}
                              disabled={isRevoking}
                              className="btn-ghost btn-sm"
                              style={{ color: '#BE123C' }}
                            >
                              {isRevoking ? 'Revoking…' : 'Revoke'}
                            </button>
                          </div>
                          {resend.status === 'failed' && (
                            <div style={{ fontSize: '0.75rem', color: '#BE123C', marginTop: '0.25rem' }}>{resend.reason}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
