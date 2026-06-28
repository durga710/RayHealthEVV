import React, { useCallback, useEffect, useRef, useState } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

/**
 * Hidden platform super-admin command center for Durga Ghimeray (Founder & CEO).
 * Not linked from any nav. Password + device-biometric (WebAuthn) login, then a
 * cross-agency monitoring console. Token (scope:'platform') lives in
 * sessionStorage, separate from the agency cookie session.
 */

const TOKEN_KEY = 'rayhealth_platform_token';
const CEO_NAME = 'Durga Ghimeray';
const CEO_TITLE = 'Founder & Chief Executive Officer';
const CEO_INITIALS = 'DG';

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

interface Stats {
  agencies: { total: number; pending: number; approved: number; rejected: number };
  users: { total: number; suspended: number; byRole: Record<string, number> };
  clients: number;
  caregivers: { total: number; active: number };
  visits: { total: number; today: number; last7d: number; verified: number };
  exceptions: { open: number };
  claims: { total: number; byStatus: Record<string, number>; chargedCents: number; paidCents: number };
  generatedAt: string;
}

interface ActivityRow {
  id: string;
  eventType: string;
  entityType: string;
  actorType: string;
  outcome: string;
  agencyId: string;
  agencyName: string | null;
  occurredAt: string | null;
}

interface AgencyDetail extends AgencyRow {
  caregiverCount: number;
  visitCount: number;
  claimCount: number;
  chargedCents: number;
  users: UserRow[];
  recentActivity: ActivityRow[];
}

const C = {
  bg: '#070b14',
  bg2: '#0b1220',
  card: '#111a2c',
  cardHi: '#16223a',
  border: '#1f2c45',
  text: '#eef3fb',
  muted: '#8595b2',
  faint: '#5a6987',
  accent: '#6366f1',
  accent2: '#8b5cf6',
  cyan: '#22d3ee',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899',
};

const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Working late';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_TONE: Record<string, string> = {
  'account.suspended': C.red,
  'agency.review.rejected': C.red,
  'agency.review.approved': C.green,
  'account.reactivated': C.green,
  'auth.login.failure': C.amber,
  'permission.denied': C.amber,
  'csrf.failure': C.amber,
};
const eventTone = (e: string): string => EVENT_TONE[e] ?? (e.includes('fail') || e.includes('denied') ? C.amber : C.cyan);

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/superadmin${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const err = new Error(body.message || `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ---------------- Small presentational pieces ----------------

function StatusBadge({ status }: { status: AgencyRow['reviewStatus'] }) {
  const c = status === 'approved' ? C.green : status === 'rejected' ? C.red : C.amber;
  return (
    <span style={{ color: c, background: `${c}1a`, border: `1px solid ${c}55`, borderRadius: 999, padding: '0.12rem 0.6rem', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, tone, glow }: { label: string; value: string; sub?: string; tone: string; glow?: boolean }) {
  return (
    <div style={{
      background: glow ? `linear-gradient(160deg, ${tone}22, ${C.card})` : C.card,
      border: `1px solid ${glow ? `${tone}55` : C.border}`,
      borderRadius: 16, padding: '1.1rem 1.2rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: tone }} />
      <div style={{ color: C.muted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ color: C.text, fontSize: '1.9rem', fontWeight: 800, marginTop: '0.3rem', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontSize: '0.76rem', marginTop: '0.35rem' }}>{sub}</div>}
    </div>
  );
}

const btn = (bg: string, ghost?: boolean): React.CSSProperties => ({
  background: ghost ? 'transparent' : bg, color: ghost ? bg : '#fff',
  border: ghost ? `1px solid ${bg}66` : 'none', borderRadius: 9,
  padding: '0.45rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
});

// ============================================================

export function SuperAdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));

  // login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [bioStatus, setBioStatus] = useState<string | null>(null);

  // dashboard state
  const [stats, setStats] = useState<Stats | null>(null);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [detail, setDetail] = useState<AgencyDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'agencies' | 'users'>('overview');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [clock, setClock] = useState(new Date());

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStats(null); setAgencies([]); setUsers([]); setActivity([]); setDetail(null);
  }, []);

  const load = useCallback(async (t: string) => {
    setLoadErr(null);
    try {
      const [s, a, u, act] = await Promise.all([
        api<Stats>('/stats', t),
        api<AgencyRow[]>('/agencies', t),
        api<UserRow[]>('/users', t),
        api<ActivityRow[]>('/activity?limit=50', t),
      ]);
      setStats(s); setAgencies(a); setUsers(u); setActivity(act);
      setLastSync(new Date());
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) { logout(); setLoginErr('Session expired. Sign in again.'); }
      else setLoadErr(e.message);
    }
  }, [logout]);

  useEffect(() => { if (token) void load(token); }, [token, load]);

  // live clock + auto-refresh every 30s
  useEffect(() => {
    const c = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(c);
  }, []);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  useEffect(() => {
    if (!token) return;
    const r = setInterval(() => { if (tokenRef.current) void load(tokenRef.current); }, 30000);
    return () => clearInterval(r);
  }, [token, load]);

  // ---------- login (password + WebAuthn) ----------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true); setLoginErr(null); setBioStatus(null);
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { stage?: 'enroll' | '2fa'; stageToken?: string; options?: unknown; message?: string };
      if (!res.ok || !body.stage || !body.stageToken) { setLoginErr(body.message || 'Invalid credentials'); return; }
      if (!browserSupportsWebAuthn()) { setLoginErr('This browser lacks device biometrics. Use a device with Face ID / Windows Hello.'); return; }

      let verifyPath: string; let verifyBody: Record<string, unknown>;
      if (body.stage === 'enroll') {
        setBioStatus('First sign-in on this device — set up Face ID / biometric…');
        const att = await startRegistration({ optionsJSON: body.options as never });
        verifyPath = '/api/superadmin/webauthn/register/verify';
        verifyBody = { stageToken: body.stageToken, response: att, deviceLabel: navigator.platform || 'device' };
      } else {
        setBioStatus('Confirm your identity with Face ID / biometric…');
        const asr = await startAuthentication({ optionsJSON: body.options as never });
        verifyPath = '/api/superadmin/webauthn/authenticate/verify';
        verifyBody = { stageToken: body.stageToken, response: asr };
      }
      const vres = await fetch(verifyPath, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(verifyBody) });
      const vbody = (await vres.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!vres.ok || !vbody.token) { setLoginErr(vbody.message || 'Biometric verification failed.'); return; }
      sessionStorage.setItem(TOKEN_KEY, vbody.token);
      setPassword(''); setToken(vbody.token);
    } catch (err) {
      setLoginErr((err as Error)?.message || 'Biometric prompt was cancelled.');
    } finally {
      setLoggingIn(false); setBioStatus(null);
    }
  };

  // ---------- actions ----------
  const reviewAgency = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    setBusy(id);
    try { await api(`/agencies/${id}/${action}`, token, { method: 'POST', body: JSON.stringify({}) }); await load(token); if (detail?.id === id) void openDetail(id); }
    catch (err) { setLoadErr((err as Error).message); }
    finally { setBusy(null); }
  };
  const toggleSuspend = async (u: UserRow) => {
    if (!token) return;
    setBusy(u.id);
    try { await api(`/users/${u.id}/${u.suspendedAt ? 'reactivate' : 'suspend'}`, token, { method: 'POST', body: JSON.stringify({}) }); await load(token); if (detail) void openDetail(detail.id); }
    catch (err) { setLoadErr((err as Error).message); }
    finally { setBusy(null); }
  };
  const openDetail = async (id: string) => {
    if (!token) return;
    try { setDetail(await api<AgencyDetail>(`/agencies/${id}`, token)); }
    catch (err) { setLoadErr((err as Error).message); }
  };

  // ===================== LOGIN SCREEN =====================
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 600px at 70% -10%, ${C.accent}22, ${C.bg})`, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '2.25rem', width: 380, display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>{CEO_INITIALS}</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.15rem' }}>Command Center</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: '0.78rem' }}>RayHealth Platform · restricted</p>
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: C.muted }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 9, padding: '0.6rem 0.75rem', fontSize: '0.95rem' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: C.muted }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 9, padding: '0.6rem 0.75rem', fontSize: '0.95rem' }} />
          </label>
          {bioStatus && <div role="status" style={{ color: C.cyan, fontSize: '0.82rem' }}>{bioStatus}</div>}
          {loginErr && <div role="alert" style={{ color: C.red, fontSize: '0.82rem' }}>{loginErr}</div>}
          <button type="submit" disabled={loggingIn} style={{ ...btn(C.accent), opacity: loggingIn ? 0.6 : 1, padding: '0.7rem', fontSize: '0.9rem' }}>
            {loggingIn ? 'Verifying…' : 'Sign in'}
          </button>
          <p style={{ margin: 0, color: C.faint, fontSize: '0.7rem', textAlign: 'center' }}>Password + device biometric (Face ID / Windows Hello).</p>
        </form>
      </div>
    );
  }

  // ===================== DASHBOARD =====================
  const pending = agencies.filter((a) => a.reviewStatus === 'pending');
  const fmtTime = clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate = clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(900px 500px at 100% -5%, ${C.accent}14, ${C.bg})`, color: C.text, fontFamily: 'Inter, system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* personalized header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', boxShadow: `0 8px 24px ${C.accent}55` }}>{CEO_INITIALS}</div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1 }}>{greeting()}, Durga</div>
              <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: '0.15rem' }}>{CEO_NAME} · {CEO_TITLE}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.35rem', fontWeight: 700, color: C.cyan }}>{fmtTime}</div>
            <div style={{ color: C.faint, fontSize: '0.78rem' }}>{fmtDate}</div>
            <button type="button" onClick={logout} style={{ ...btn(C.border, true), marginTop: '0.4rem', color: C.muted }}>Sign out</button>
          </div>
        </header>

        {/* alert bar for pending reviews */}
        {pending.length > 0 && (
          <div style={{ background: `${C.amber}14`, border: `1px solid ${C.amber}55`, borderRadius: 12, padding: '0.7rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <span style={{ color: C.text, fontWeight: 600 }}>{pending.length} agenc{pending.length === 1 ? 'y' : 'ies'} awaiting your review.</span>
            <button type="button" onClick={() => setTab('agencies')} style={{ ...btn(C.amber, true), marginLeft: 'auto' }}>Review now →</button>
          </div>
        )}

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', marginBottom: '1.25rem' }}>
          <KpiCard label="Agencies" value={String(stats?.agencies.total ?? '—')} sub={`${stats?.agencies.approved ?? 0} active · ${stats?.agencies.pending ?? 0} pending`} tone={C.accent} glow />
          <KpiCard label="Users" value={String(stats?.users.total ?? '—')} sub={`${stats?.users.suspended ?? 0} suspended`} tone={C.cyan} />
          <KpiCard label="Clients" value={String(stats?.clients ?? '—')} sub="across all agencies" tone={C.pink} />
          <KpiCard label="Caregivers" value={String(stats?.caregivers.total ?? '—')} sub={`${stats?.caregivers.active ?? 0} active`} tone={C.green} />
          <KpiCard label="Visits today" value={String(stats?.visits.today ?? '—')} sub={`${stats?.visits.last7d ?? 0} in 7d · ${stats?.visits.total ?? 0} all-time`} tone={C.accent2} />
          <KpiCard label="Open exceptions" value={String(stats?.exceptions.open ?? '—')} sub="need resolution" tone={(stats?.exceptions.open ?? 0) > 0 ? C.amber : C.green} />
          <KpiCard label="Claims" value={String(stats?.claims.total ?? '—')} sub={`${money(stats?.claims.chargedCents ?? 0)} billed`} tone={C.cyan} />
          <KpiCard label="Collected" value={money(stats?.claims.paidCents ?? 0)} sub="payer remittances posted" tone={C.green} glow />
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', alignItems: 'center' }}>
          {(['overview', 'agencies', 'users'] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setDetail(null); }} style={{ ...btn(tab === t ? C.accent : C.card, tab !== t), textTransform: 'capitalize', color: tab === t ? '#fff' : C.muted }}>{t}</button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem', color: C.faint, fontSize: '0.74rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
              live · auto-refresh 30s
            </span>
            {lastSync && <span>synced {timeAgo(lastSync.toISOString())}</span>}
            {token && <button type="button" onClick={() => void load(token)} style={{ ...btn(C.border, true), color: C.muted }}>Refresh</button>}
          </div>
        </div>

        {loadErr && <div role="alert" style={{ color: C.red, marginBottom: '1rem' }}>{loadErr}</div>}

        {/* ---------- OVERVIEW ---------- */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <Panel title="Needs your attention">
                {pending.length === 0 ? (
                  <Empty>All clear — no agencies awaiting review.</Empty>
                ) : pending.map((a) => (
                  <div key={a.id} style={rowCard}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.name}</div>
                      <div style={{ color: C.muted, fontSize: '0.8rem' }}>{a.adminEmails.join(', ') || 'no admin email'} · signed up {timeAgo(a.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn(C.green)}>Approve</button>
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn(C.red, true)}>Reject</button>
                    </div>
                  </div>
                ))}
              </Panel>
              <Panel title="Role distribution">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {stats && Object.entries(stats.users.byRole).map(([role, n]) => (
                    <div key={role} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.5rem 0.8rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{n}</span>
                      <span style={{ color: C.muted, fontSize: '0.78rem', marginLeft: '0.4rem', textTransform: 'capitalize' }}>{role}</span>
                    </div>
                  ))}
                  {(!stats || Object.keys(stats.users.byRole).length === 0) && <Empty>No users yet.</Empty>}
                </div>
              </Panel>
            </div>
            <Panel title="Live activity" scroll>
              {activity.length === 0 ? <Empty>No recent activity.</Empty> : activity.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: eventTone(ev.eventType), marginTop: 6, flexShrink: 0, boxShadow: `0 0 6px ${eventTone(ev.eventType)}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ev.eventType}</div>
                    <div style={{ color: C.faint, fontSize: '0.72rem' }}>{ev.agencyName ?? '—'} · {ev.actorType} · {ev.outcome}</div>
                  </div>
                  <span style={{ color: C.faint, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{timeAgo(ev.occurredAt)}</span>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {/* ---------- AGENCIES ---------- */}
        {tab === 'agencies' && (detail ? (
          <AgencyDetailView detail={detail} busy={busy} onBack={() => setDetail(null)} onReview={reviewAgency} onToggleSuspend={toggleSuspend} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {agencies.length === 0 && <Empty>No agencies yet.</Empty>}
            {agencies.map((a) => (
              <div key={a.id} style={{ ...rowCard, borderColor: a.reviewStatus === 'pending' ? `${C.amber}66` : C.border, cursor: 'pointer' }} onClick={() => openDetail(a.id)}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name} <span style={{ color: C.faint, fontWeight: 400, fontSize: '0.8rem' }}>· {a.state}</span></div>
                  <div style={{ color: C.muted, fontSize: '0.8rem', marginTop: '0.2rem' }}>{a.adminEmails.join(', ') || 'no admin email'} · {a.userCount} users · {a.clientCount} clients · signed up {timeAgo(a.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <StatusBadge status={a.reviewStatus} />
                  {a.reviewStatus !== 'approved' && <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn(C.green)}>Approve</button>}
                  {a.reviewStatus !== 'rejected' && <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn(C.red, true)}>Reject</button>}
                  <span style={{ color: C.faint, fontSize: '1.1rem' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ---------- USERS ---------- */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {users.length === 0 && <Empty>No users yet.</Empty>}
            {users.map((u) => <UserRowView key={u.id} u={u} busy={busy === u.id} onToggle={() => toggleSuspend(u)} />)}
          </div>
        )}

        <footer style={{ marginTop: '2rem', textAlign: 'center', color: C.faint, fontSize: '0.72rem' }}>
          RayHealth Platform Command Center · for {CEO_NAME} only · all actions are audit-logged
        </footer>
      </div>
    </div>
  );
}

// ---------------- sub-components ----------------

const rowCard: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
  padding: '0.85rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
};

function Panel({ title, children, scroll }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.1rem 1.2rem' }}>
      <h3 style={{ margin: '0 0 0.9rem', fontSize: '0.95rem', fontWeight: 800 }}>{title}</h3>
      <div style={scroll ? { maxHeight: 520, overflowY: 'auto' } : undefined}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.faint, fontSize: '0.85rem', padding: '0.5rem 0' }}>{children}</div>;
}

function UserRowView({ u, busy, onToggle }: { u: UserRow; busy: boolean; onToggle: () => void }) {
  return (
    <div style={{ ...rowCard, padding: '0.7rem 1rem' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{u.email} {u.suspendedAt && <span style={{ color: C.red, fontSize: '0.7rem', fontWeight: 800 }}>· SUSPENDED</span>}</div>
        <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: '0.15rem' }}>{u.role} · {u.agencyName ?? u.agencyId.slice(0, 8)} · joined {timeAgo(u.createdAt)}</div>
      </div>
      <button type="button" disabled={busy} onClick={onToggle} style={btn(u.suspendedAt ? C.green : C.red, !u.suspendedAt)}>{u.suspendedAt ? 'Reactivate' : 'Suspend'}</button>
    </div>
  );
}

function AgencyDetailView({ detail, busy, onBack, onReview, onToggleSuspend }: {
  detail: AgencyDetail; busy: string | null; onBack: () => void;
  onReview: (id: string, a: 'approve' | 'reject') => void; onToggleSuspend: (u: UserRow) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={btn(C.border, true)}>← All agencies</button>
        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{detail.name}</h2>
        <StatusBadge status={detail.reviewStatus} />
        <span style={{ color: C.faint, fontSize: '0.8rem' }}>{detail.state} · signed up {timeAgo(detail.createdAt)}{detail.reviewedBy ? ` · reviewed by ${detail.reviewedBy}` : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem' }}>
          {detail.reviewStatus !== 'approved' && <button type="button" disabled={busy === detail.id} onClick={() => onReview(detail.id, 'approve')} style={btn(C.green)}>Approve</button>}
          {detail.reviewStatus !== 'rejected' && <button type="button" disabled={busy === detail.id} onClick={() => onReview(detail.id, 'reject')} style={btn(C.red, true)}>Reject</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.7rem' }}>
        <KpiCard label="Users" value={String(detail.userCount)} tone={C.cyan} />
        <KpiCard label="Clients" value={String(detail.clientCount)} tone={C.pink} />
        <KpiCard label="Caregivers" value={String(detail.caregiverCount)} tone={C.green} />
        <KpiCard label="Visits" value={String(detail.visitCount)} tone={C.accent2} />
        <KpiCard label="Claims" value={String(detail.claimCount)} sub={money(detail.chargedCents)} tone={C.accent} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
        <Panel title={`Users (${detail.users.length})`} scroll>
          {detail.users.length === 0 ? <Empty>No users.</Empty> : detail.users.map((u) => (
            <UserRowView key={u.id} u={u} busy={busy === u.id} onToggle={() => onToggleSuspend(u)} />
          ))}
        </Panel>
        <Panel title="Recent activity" scroll>
          {detail.recentActivity.length === 0 ? <Empty>No activity.</Empty> : detail.recentActivity.map((ev) => (
            <div key={ev.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: eventTone(ev.eventType), marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ev.eventType}</div>
                <div style={{ color: C.faint, fontSize: '0.72rem' }}>{ev.actorType} · {ev.outcome}</div>
              </div>
              <span style={{ color: C.faint, fontSize: '0.7rem' }}>{timeAgo(ev.occurredAt)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
