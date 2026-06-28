import React, { useCallback, useEffect, useState } from 'react';

/**
 * Hidden platform super-admin console. Not linked from any nav. Authenticates
 * with its own bearer token (scope:'platform') held in sessionStorage —
 * completely separate from the agency cookie session. Reachable only by typing
 * the /superadmin URL and signing in with the platform credentials.
 */

const TOKEN_KEY = 'rayhealth_platform_token';

interface AgencyRow {
  id: string;
  name: string;
  state: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  userCount: number;
  clientCount: number;
  adminEmails: string[];
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  agencyId: string;
  agencyName: string | null;
  createdAt: string | null;
  suspendedAt: string | null;
}

const colors = {
  bg: '#0b1220',
  card: '#141d2e',
  border: '#243049',
  text: '#e6edf7',
  muted: '#8b9ab3',
  accent: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/superadmin${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const err = new Error(body.message || `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function StatusBadge({ status }: { status: AgencyRow['reviewStatus'] }) {
  const c = status === 'approved' ? colors.green : status === 'rejected' ? colors.red : colors.amber;
  return (
    <span style={{ color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {status}
    </span>
  );
}

export function SuperAdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'agencies' | 'users'>('agencies');

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAgencies([]);
    setUsers([]);
  }, []);

  const load = useCallback(async (t: string) => {
    setLoadErr(null);
    try {
      const [a, u] = await Promise.all([
        api<AgencyRow[]>('/agencies', t),
        api<UserRow[]>('/users', t),
      ]);
      setAgencies(a);
      setUsers(u);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        logout();
        setLoginErr('Session expired. Sign in again.');
      } else {
        setLoadErr(e.message);
      }
    }
  }, [logout]);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr(null);
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!res.ok || !body.token) {
        setLoginErr(body.message || 'Invalid credentials');
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, body.token);
      setPassword('');
      setToken(body.token);
    } catch {
      setLoginErr('Could not reach the server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const reviewAgency = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    setBusy(id);
    try {
      await api(`/agencies/${id}/${action}`, token, { method: 'POST', body: JSON.stringify({}) });
      await load(token);
    } catch (err) {
      setLoadErr((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleSuspend = async (u: UserRow) => {
    if (!token) return;
    const action = u.suspendedAt ? 'reactivate' : 'suspend';
    setBusy(u.id);
    try {
      await api(`/users/${u.id}/${action}`, token, { method: 'POST', body: JSON.stringify({}) });
      await load(token);
    } catch (err) {
      setLoadErr((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
    borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', width: '100%',
  };
  const btn = (bg: string): React.CSSProperties => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 8,
    padding: '0.45rem 0.9rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
  });

  // ---------- Login screen ----------
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '2rem', width: 360, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Platform Console</h1>
            <p style={{ margin: '0.35rem 0 0', color: colors.muted, fontSize: '0.85rem' }}>Restricted access.</p>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: colors.muted }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" style={inputStyle} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: colors.muted }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={inputStyle} required />
          </label>
          {loginErr && <div role="alert" style={{ color: colors.red, fontSize: '0.85rem' }}>{loginErr}</div>}
          <button type="submit" disabled={loggingIn} style={{ ...btn(colors.accent), opacity: loggingIn ? 0.6 : 1, padding: '0.65rem' }}>
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  // ---------- Dashboard ----------
  const pending = agencies.filter((a) => a.reviewStatus === 'pending');
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'Inter, system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Platform Console</h1>
            <p style={{ margin: '0.25rem 0 0', color: colors.muted, fontSize: '0.85rem' }}>
              {pending.length} agenc{pending.length === 1 ? 'y' : 'ies'} awaiting review · {agencies.length} total · {users.length} users
            </p>
          </div>
          <button type="button" onClick={logout} style={btn(colors.border)}>Sign out</button>
        </header>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['agencies', 'users'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ ...btn(tab === t ? colors.accent : colors.card), textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {loadErr && <div role="alert" style={{ color: colors.red, marginBottom: '1rem' }}>{loadErr}</div>}

        {tab === 'agencies' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {agencies.length === 0 && <p style={{ color: colors.muted }}>No agencies yet.</p>}
            {agencies.map((a) => (
              <div key={a.id} style={{ background: colors.card, border: `1px solid ${a.reviewStatus === 'pending' ? colors.amber : colors.border}`, borderRadius: 12, padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{a.name} <span style={{ color: colors.muted, fontWeight: 400 }}>· {a.state}</span></div>
                    <div style={{ color: colors.muted, fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      {a.adminEmails.join(', ') || 'no admin email'} · {a.userCount} users · {a.clientCount} clients
                    </div>
                    <div style={{ color: colors.muted, fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      Signed up {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                      {a.reviewedBy ? ` · reviewed by ${a.reviewedBy}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <StatusBadge status={a.reviewStatus} />
                    {a.reviewStatus !== 'approved' && (
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn(colors.green)}>Approve</button>
                    )}
                    {a.reviewStatus !== 'rejected' && (
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn(colors.red)}>Reject</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.length === 0 && <p style={{ color: colors.muted }}>No users yet.</p>}
            {users.map((u) => (
              <div key={u.id} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {u.email} {u.suspendedAt && <span style={{ color: colors.red, fontSize: '0.72rem', fontWeight: 700 }}>· SUSPENDED</span>}
                  </div>
                  <div style={{ color: colors.muted, fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    {u.role} · {u.agencyName ?? u.agencyId.slice(0, 8)} · joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <button type="button" disabled={busy === u.id} onClick={() => toggleSuspend(u)} style={btn(u.suspendedAt ? colors.green : colors.red)}>
                  {u.suspendedAt ? 'Reactivate' : 'Suspend'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
