import { useEffect, useState } from 'react';
import { getJson, postJson, patchJson, deleteJson } from '../../lib/api-client.js';

/**
 * Account settings — Security (TOTP 2FA + active sessions), Notifications,
 * Preferences (appearance/locale), and Account & data (export, deletion).
 * Mounted at both /admin/settings and /portal/settings. Talks to /api/settings.
 */

interface NotificationPrefs {
  channelEmail?: boolean;
  channelSms?: boolean;
  channelInApp?: boolean;
  visitReminders?: boolean;
  scheduleChanges?: boolean;
  trainingDue?: boolean;
  billingAlerts?: boolean;
  productUpdates?: boolean;
}

interface Preferences {
  timezone?: string;
  language?: string;
  theme?: 'system' | 'light' | 'dark';
}

interface SettingsSummary {
  twoFactorEnabled: boolean;
  notificationPrefs: NotificationPrefs | null;
  preferences: Preferences | null;
  deletionRequestedAt: string | null;
}

interface SessionInfo {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string | null;
  expiresAt: string;
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.25rem' };
const h2: React.CSSProperties = { fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748B', margin: '0 0 1rem' };
const btnPrimary: React.CSSProperties = { padding: '0.5rem 1.1rem', fontWeight: 600, fontSize: '0.875rem', color: '#fff', background: '#107480', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '0.5rem 1.1rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '0.5rem 1.1rem', fontWeight: 600, fontSize: '0.875rem', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { padding: '0.5rem 0.7rem', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', color: '#0F172A' };

const NOTIF_ROWS: Array<{ key: keyof NotificationPrefs; label: string }> = [
  { key: 'visitReminders', label: 'Visit reminders' },
  { key: 'scheduleChanges', label: 'Schedule changes' },
  { key: 'trainingDue', label: 'Training due / expiring' },
  { key: 'billingAlerts', label: 'Billing & claim alerts' },
  { key: 'productUpdates', label: 'Product updates' },
];
const CHANNEL_ROWS: Array<{ key: keyof NotificationPrefs; label: string }> = [
  { key: 'channelEmail', label: 'Email' },
  { key: 'channelSms', label: 'SMS' },
  { key: 'channelInApp', label: 'In-app' },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? '#107480' : '#CBD5E1', position: 'relative', transition: 'background .15s', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

export function SettingsPage() {
  const [summary, setSummary] = useState<SettingsSummary | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // 2FA enrollment flow
  const [twoFaSetup, setTwoFaSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2500); };

  const reload = () => {
    void Promise.all([
      getJson<SettingsSummary>('/api/settings'),
      getJson<{ sessions: SessionInfo[] }>('/api/settings/sessions'),
    ]).then(([s, sess]) => {
      setSummary(s);
      setSessions(sess.sessions ?? []);
    }).catch(() => undefined).finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const notif = summary?.notificationPrefs ?? {};
  const prefs = summary?.preferences ?? {};

  const saveNotif = async (key: keyof NotificationPrefs, value: boolean) => {
    setSummary((prev) => prev ? { ...prev, notificationPrefs: { ...prev.notificationPrefs, [key]: value } } : prev);
    try { await patchJson('/api/settings/notifications', { [key]: value }); } catch { flash('Failed to save'); }
  };
  const savePref = async (patch: Preferences) => {
    setSummary((prev) => prev ? { ...prev, preferences: { ...prev.preferences, ...patch } } : prev);
    try { await patchJson('/api/settings/preferences', patch); flash('Saved'); } catch { flash('Failed to save'); }
  };

  const startTwoFa = async () => {
    setTwoFaError(null);
    try {
      const r = await postJson<{ qrDataUrl: string; secret: string }>('/api/settings/2fa/setup', {});
      setTwoFaSetup({ qrDataUrl: r.qrDataUrl, secret: r.secret });
    } catch (e) { setTwoFaError(e instanceof Error ? e.message : 'Failed to start setup'); }
  };
  const enableTwoFa = async () => {
    setTwoFaError(null);
    try {
      const r = await postJson<{ backupCodes: string[] }>('/api/settings/2fa/enable', { token: twoFaCode.trim() });
      setBackupCodes(r.backupCodes);
      setTwoFaSetup(null);
      setTwoFaCode('');
      reload();
    } catch (e) { setTwoFaError(e instanceof Error ? e.message : 'Invalid code'); }
  };
  const disableTwoFa = async () => {
    setTwoFaError(null);
    try {
      await postJson('/api/settings/2fa/disable', { password: disablePassword });
      setShowDisable(false);
      setDisablePassword('');
      flash('Two-factor disabled');
      reload();
    } catch (e) { setTwoFaError(e instanceof Error ? e.message : 'Incorrect password'); }
  };

  const revokeSession = async (id: string) => {
    try { await deleteJson(`/api/settings/sessions/${id}`); setSessions((prev) => prev.filter((s) => s.id !== id)); } catch { flash('Failed'); }
  };
  const revokeOthers = async () => {
    try { await postJson('/api/settings/sessions/revoke-others', {}); flash('Signed out other sessions'); reload(); } catch { flash('Failed'); }
  };

  const exportData = async () => {
    try {
      const res = await fetch('/api/settings/export', { credentials: 'include' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'rayhealth-data-export.json'; a.click();
      URL.revokeObjectURL(url);
    } catch { flash('Export failed'); }
  };
  const requestDeletion = async () => {
    if (!window.confirm('Request account deletion? Your agency administrator will be notified to process this request.')) return;
    try { await postJson('/api/settings/account/delete-request', {}); flash('Deletion requested'); reload(); } catch { flash('Failed'); }
  };
  const cancelDeletion = async () => {
    try { await deleteJson('/api/settings/account/delete-request'); flash('Deletion request canceled'); reload(); } catch { flash('Failed'); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#64748B' }}>Loading settings…</div>;

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: '0 0 1.25rem' }}>Settings</h1>

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0F172A', color: '#fff', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.875rem', zIndex: 50 }}>{toast}</div>
      )}

      {/* Security */}
      <div style={card}>
        <h2 style={h2}>Two-factor authentication</h2>
        <p style={sub}>Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password).</p>

        {backupCodes && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#92400E', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Save your backup codes</div>
            <p style={{ fontSize: '0.8125rem', color: '#92400E', margin: '0 0 0.75rem' }}>Each code works once if you lose your authenticator. Store them somewhere safe — they won&rsquo;t be shown again.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontFamily: 'monospace', fontSize: '0.875rem', color: '#0F172A' }}>
              {backupCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <button type="button" style={{ ...btnGhost, marginTop: '0.85rem' }} onClick={() => setBackupCodes(null)}>I&rsquo;ve saved these</button>
          </div>
        )}

        {summary?.twoFactorEnabled ? (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#15803D', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.85rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>
              Enabled
            </div>
            {showDisable ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '320px' }}>
                <input type="password" placeholder="Confirm your password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} style={inputStyle} />
                {twoFaError && <span style={{ color: '#DC2626', fontSize: '0.8125rem' }}>{twoFaError}</span>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" style={btnDanger} onClick={() => void disableTwoFa()}>Disable 2FA</button>
                  <button type="button" style={btnGhost} onClick={() => { setShowDisable(false); setTwoFaError(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" style={btnGhost} onClick={() => setShowDisable(true)}>Disable two-factor</button>
            )}
          </div>
        ) : twoFaSetup ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '360px' }}>
            <img src={twoFaSetup.qrDataUrl} alt="2FA QR code" width={180} height={180} style={{ border: '1px solid #E2E8F0', borderRadius: '8px' }} />
            <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>Or enter this key manually: <code style={{ fontFamily: 'monospace', color: '#0F172A' }}>{twoFaSetup.secret}</code></div>
            <input type="text" inputMode="numeric" placeholder="6-digit code" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} style={inputStyle} />
            {twoFaError && <span style={{ color: '#DC2626', fontSize: '0.8125rem' }}>{twoFaError}</span>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" style={btnPrimary} onClick={() => void enableTwoFa()}>Verify & enable</button>
              <button type="button" style={btnGhost} onClick={() => { setTwoFaSetup(null); setTwoFaError(null); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {twoFaError && <div style={{ color: '#DC2626', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{twoFaError}</div>}
            <button type="button" style={btnPrimary} onClick={() => void startTwoFa()}>Enable two-factor</button>
          </>
        )}
      </div>

      {/* Sessions */}
      <div style={card}>
        <h2 style={h2}>Active sessions</h2>
        <p style={sub}>Devices currently signed in to your account.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', border: '1px solid #E2E8F0', borderRadius: '8px', gap: '0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.userAgent ?? 'Unknown device'} {s.current && <span style={{ color: '#15803D', fontWeight: 700 }}>· This device</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{s.ipAddress ?? '—'} · expires {new Date(s.expiresAt).toLocaleDateString()}</div>
              </div>
              {!s.current && <button type="button" style={btnGhost} onClick={() => void revokeSession(s.id)}>Revoke</button>}
            </div>
          ))}
        </div>
        {sessions.length > 1 && (
          <button type="button" style={{ ...btnGhost, marginTop: '0.85rem' }} onClick={() => void revokeOthers()}>Sign out all other sessions</button>
        )}
      </div>

      {/* Notifications */}
      <div style={card}>
        <h2 style={h2}>Notifications</h2>
        <p style={sub}>Choose how and what you&rsquo;re notified about.</p>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.5rem' }}>Channels</div>
        {CHANNEL_ROWS.map((r) => (
          <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0' }}>
            <span style={{ fontSize: '0.875rem', color: '#334155' }}>{r.label}</span>
            <Toggle on={notif[r.key] ?? (r.key !== 'channelSms')} onChange={(v) => void saveNotif(r.key, v)} />
          </div>
        ))}
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1rem 0 0.5rem' }}>Events</div>
        {NOTIF_ROWS.map((r) => (
          <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0' }}>
            <span style={{ fontSize: '0.875rem', color: '#334155' }}>{r.label}</span>
            <Toggle on={notif[r.key] ?? true} onChange={(v) => void saveNotif(r.key, v)} />
          </div>
        ))}
      </div>

      {/* Preferences */}
      <div style={card}>
        <h2 style={h2}>Appearance & locale</h2>
        <p style={sub}>Personal display preferences for your account.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Theme</label>
            <select value={prefs.theme ?? 'system'} onChange={(e) => void savePref({ theme: e.target.value as Preferences['theme'] })} style={{ ...inputStyle, width: '100%' }}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>Time zone</label>
            <select value={prefs.timezone ?? 'America/New_York'} onChange={(e) => void savePref({ timezone: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
              <option value="America/New_York">Eastern (New York)</option>
              <option value="America/Chicago">Central (Chicago)</option>
              <option value="America/Denver">Mountain (Denver)</option>
              <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Account & data */}
      <div style={card}>
        <h2 style={h2}>Account &amp; data</h2>
        <p style={sub}>Export your data or request account deletion.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={btnGhost} onClick={() => void exportData()}>Export my data (JSON)</button>
          {summary?.deletionRequestedAt ? (
            <button type="button" style={btnGhost} onClick={() => void cancelDeletion()}>Cancel deletion request</button>
          ) : (
            <button type="button" style={btnDanger} onClick={() => void requestDeletion()}>Request account deletion</button>
          )}
        </div>
        {summary?.deletionRequestedAt && (
          <p style={{ fontSize: '0.8125rem', color: '#B45309', margin: '0.85rem 0 0' }}>
            Deletion requested on {new Date(summary.deletionRequestedAt).toLocaleDateString()}. Your administrator will process it.
          </p>
        )}
      </div>
    </div>
  );
}
