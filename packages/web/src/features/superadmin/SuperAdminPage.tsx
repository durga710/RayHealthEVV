import React, { useCallback, useEffect, useState } from 'react';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { BrandLogo } from '../../components/brand/BrandLogo.js';

/**
 * Hidden platform super-admin command center for Durga Ghimeray (Founder & CEO).
 * Not linked from any nav. Password + device-biometric (WebAuthn) login, then a
 * cross-agency monitoring console. The platform token (scope:'platform') is held
 * ONLY in an httpOnly cookie set by the server — never in JS-readable storage —
 * so an XSS anywhere in the SPA cannot exfiltrate it.
 */

const CEO_NAME = 'Durga Ghimeray';
const CEO_TITLE = 'Founder & CEO';
const CEO_INITIALS = 'DG';

interface AgencyRow {
  id: string; name: string; state: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null; reviewedBy: string | null; reviewNotes: string | null;
  createdAt: string | null; userCount: number; clientCount: number; adminEmails: string[];
}
interface UserRow {
  id: string; email: string; role: string; agencyId: string;
  agencyName: string | null; createdAt: string | null; suspendedAt: string | null;
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
  id: string; eventType: string; entityType: string; actorType: string;
  outcome: string; agencyId: string; agencyName: string | null; occurredAt: string | null;
}
interface AgencyDetail extends AgencyRow {
  caregiverCount: number; visitCount: number; claimCount: number; chargedCents: number;
  users: UserRow[]; recentActivity: ActivityRow[];
}

// Restrained, near-monochrome palette. One brand accent (emerald). Color is
// used sparingly and only where it carries meaning.
const C = {
  canvas: '#f6f7f9',
  surface: '#ffffff',
  ink: '#15171c',
  ink2: '#565b66',
  ink3: '#969ba6',
  line: '#eceef1',
  line2: '#e1e3e8',
  sidebar: '#16181d',
  sidebarPanel: '#1d2026',
  accent: '#0b7a52',
  accentInk: '#0b7a52',
  accentSoft: '#e8f3ee',
  green: '#0b7a52', greenSoft: '#e8f3ee',
  amber: '#8a6400', amberSoft: '#f8f0dd',
  red: '#b3261e', redSoft: '#fbeae8',
  blue: '#2b5cc4', blueSoft: '#e9eefb',
};
const SIDE_INK = '#9aa0ad';
const SIDE_INK_DIM = '#6b7180';

const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  'account.suspended': C.red, 'agency.review.rejected': C.red,
  'agency.review.approved': C.green, 'account.reactivated': C.green,
  'auth.login.failure': C.amber, 'permission.denied': C.amber, 'csrf.failure': C.amber,
};
const eventTone = (e: string): string => EVENT_TONE[e] ?? (e.includes('fail') || e.includes('denied') ? C.amber : C.ink3);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/superadmin${path}`, {
    ...init,
    // Auth rides on the httpOnly `rayhealth_platform` cookie (set at login); the
    // token is never held in JS. credentials:'include' sends that cookie.
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const err = new Error(body.message || `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ---------------- line icons (no emoji) ----------------
const ICONS: Record<string, string[]> = {
  overview: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  agencies: ['M3 21h18', 'M6 21V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v17', 'M9 7h1', 'M11 7h1', 'M9 11h1', 'M11 11h1', 'M9 15h1', 'M11 15h1'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  client: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  caregiver: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z'],
  visit: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', 'M12 9v4', 'M12 17h.01'],
  claim: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  money: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  chevron: ['m9 18 6-6-6-6'],
  back: ['m12 19-7-7 7-7', 'M19 12H5'],
  refresh: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'],
};
function Icon({ name, size = 18, color, width = 1.7 }: { name: string; size?: number; color?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      {(ICONS[name] ?? []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// ---------------- presentational ----------------
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12 };

function StatusBadge({ status }: { status: AgencyRow['reviewStatus'] }) {
  const m = {
    approved: { fg: C.green, bg: C.greenSoft, label: 'Approved' },
    rejected: { fg: C.red, bg: C.redSoft, label: 'Rejected' },
    pending: { fg: C.amber, bg: C.amberSoft, label: 'Pending review' },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: m.fg, background: m.bg, borderRadius: 6, padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m.fg }} />{m.label}
    </span>
  );
}

function Kpi({ label, value, sub, icon, subTone }: { label: string; value: string; sub?: string; icon: string; subTone?: string }) {
  return (
    <div style={{ ...card, padding: '1.15rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: C.ink3, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: C.ink3 }}><Icon name={icon} size={17} /></span>
      </div>
      <div style={{ color: C.ink, fontSize: '1.9rem', fontWeight: 650, letterSpacing: '-0.02em', marginTop: '0.7rem', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ color: subTone ?? C.ink3, fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: subTone ? 600 : 400 }}>{sub}</div>}
    </div>
  );
}

const btn = (kind: 'primary' | 'default' | 'danger' | 'ghost'): React.CSSProperties => {
  const base: React.CSSProperties = { borderRadius: 8, padding: '0.45rem 0.85rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.2 };
  if (kind === 'primary') return { ...base, background: C.accent, color: '#fff', border: 'none' };
  if (kind === 'danger') return { ...base, background: C.surface, color: C.red, border: `1px solid ${C.line2}` };
  if (kind === 'ghost') return { ...base, background: 'transparent', color: C.ink2, border: `1px solid ${C.line2}` };
  return { ...base, background: C.surface, color: C.ink, border: `1px solid ${C.line2}` };
};

function Panel({ title, action, children, scroll }: { title: string; action?: React.ReactNode; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.2rem', borderBottom: `1px solid ${C.line}` }}>
        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 650, color: C.ink, letterSpacing: '-0.01em' }}>{title}</h3>
        {action}
      </div>
      <div style={{ padding: '0.4rem 1.2rem', ...(scroll ? { maxHeight: 520, overflowY: 'auto' } : {}) }}>{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.ink3, fontSize: '0.85rem', padding: '1rem 0' }}>{children}</div>;
}
function ActivityItem({ ev }: { ev: ActivityRow }) {
  return (
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', padding: '0.65rem 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: eventTone(ev.eventType), marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{ev.eventType}</div>
        <div style={{ color: C.ink2, fontSize: '0.74rem', marginTop: 1 }}>{ev.agencyName ?? '—'} · {ev.actorType} · {ev.outcome}</div>
      </div>
      <span style={{ color: C.ink3, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{timeAgo(ev.occurredAt)}</span>
    </div>
  );
}
function UserRowView({ u, busy, onToggle }: { u: UserRow; busy: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: C.ink, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
          {u.suspendedAt && <span style={{ color: C.red, fontSize: '0.66rem', fontWeight: 700, background: C.redSoft, padding: '0.1rem 0.4rem', borderRadius: 5, letterSpacing: '0.04em' }}>SUSPENDED</span>}
        </div>
        <div style={{ color: C.ink2, fontSize: '0.76rem', marginTop: '0.15rem', textTransform: 'capitalize' }}>{u.role} · {u.agencyName ?? u.agencyId.slice(0, 8)} · joined {timeAgo(u.createdAt)}</div>
      </div>
      <button type="button" disabled={busy} onClick={onToggle} style={btn(u.suspendedAt ? 'primary' : 'danger')}>{u.suspendedAt ? 'Reactivate' : 'Suspend'}</button>
    </div>
  );
}

// ============================================================
export function SuperAdminPage() {
  // Auth is a boolean, never the token itself — the platform token lives only in
  // the httpOnly `rayhealth_platform` cookie. `checking` covers the initial
  // cookie probe on mount so we don't flash the login screen for an already-
  // authenticated founder returning to the tab.
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [bioStatus, setBioStatus] = useState<string | null>(null);

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

  const clearData = () => {
    setStats(null); setAgencies([]); setUsers([]); setActivity([]); setDetail(null);
  };

  const logout = useCallback(async () => {
    // Best-effort: clear the httpOnly cookie server-side. Local state resets
    // regardless of the network result.
    try { await fetch('/api/superadmin/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    setAuthed(false); clearData();
  }, []);

  // Loads the console datasets. Success implies the platform cookie is valid, so
  // it also confirms authed; a 401 means no/expired cookie -> show login.
  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [s, a, u, act] = await Promise.all([
        api<Stats>('/stats'), api<AgencyRow[]>('/agencies'),
        api<UserRow[]>('/users'), api<ActivityRow[]>('/activity?limit=50'),
      ]);
      setStats(s); setAgencies(a); setUsers(u); setActivity(act); setLastSync(new Date());
      setAuthed(true);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) { setAuthed(false); clearData(); }
      else setLoadErr(e.message);
    }
  }, []);

  // Initial cookie probe on mount.
  useEffect(() => { void load().finally(() => setChecking(false)); }, [load]);
  useEffect(() => { const c = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(c); }, []);
  useEffect(() => {
    if (!authed) return;
    const r = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(r);
  }, [authed, load]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true); setLoginErr(null); setBioStatus(null);
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
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
      // credentials:'include' so the httpOnly platform cookie the server sets on
      // success is stored by the browser. The token in the response body is
      // ignored — it is never persisted in JS.
      const vres = await fetch(verifyPath, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify(verifyBody) });
      const vbody = (await vres.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!vres.ok || !vbody.token) { setLoginErr(vbody.message || 'Biometric verification failed.'); return; }
      setPassword(''); setAuthed(true); void load();
    } catch (err) {
      setLoginErr((err as Error)?.message || 'Biometric prompt was cancelled.');
    } finally { setLoggingIn(false); setBioStatus(null); }
  };

  const reviewAgency = async (id: string, action: 'approve' | 'reject') => {
    if (!authed) return; setBusy(id);
    try { await api(`/agencies/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) }); await load(); if (detail?.id === id) void openDetail(id); }
    catch (err) { setLoadErr((err as Error).message); } finally { setBusy(null); }
  };
  const toggleSuspend = async (u: UserRow) => {
    if (!authed) return; setBusy(u.id);
    try { await api(`/users/${u.id}/${u.suspendedAt ? 'reactivate' : 'suspend'}`, { method: 'POST', body: JSON.stringify({}) }); await load(); if (detail) void openDetail(detail.id); }
    catch (err) { setLoadErr((err as Error).message); } finally { setBusy(null); }
  };
  const openDetail = async (id: string) => {
    if (!authed) return;
    try { setDetail(await api<AgencyDetail>(`/agencies/${id}`)); } catch (err) { setLoadErr((err as Error).message); }
  };

  // Initial cookie probe in flight — don't flash the login form at a founder
  // who is already authenticated via the httpOnly cookie.
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: C.sidebar, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
    );
  }

  // ===================== LOGIN =====================
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: C.sidebar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, system-ui, sans-serif', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ background: C.surface, borderRadius: 16, padding: '2.25rem', width: 400, display: 'flex', flexDirection: 'column', gap: '1.05rem', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <BrandLogo variant="full" height={30} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.ink2, fontSize: '0.82rem', fontWeight: 600 }}>
              <span style={{ color: C.accent, display: 'flex' }}><Icon name="shield" size={15} /></span>
              Platform Command · restricted access
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: C.ink2, fontWeight: 600 }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required
              style={{ background: C.surface, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9, padding: '0.65rem 0.8rem', fontSize: '0.95rem' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: C.ink2, fontWeight: 600 }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required
              style={{ background: C.surface, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9, padding: '0.65rem 0.8rem', fontSize: '0.95rem' }} />
          </label>
          {bioStatus && <div role="status" style={{ color: C.accent, fontSize: '0.82rem', background: C.accentSoft, padding: '0.55rem 0.75rem', borderRadius: 8 }}>{bioStatus}</div>}
          {loginErr && <div role="alert" style={{ color: C.red, fontSize: '0.82rem', background: C.redSoft, padding: '0.55rem 0.75rem', borderRadius: 8 }}>{loginErr}</div>}
          <button type="submit" disabled={loggingIn} style={{ ...btn('primary'), opacity: loggingIn ? 0.6 : 1, padding: '0.75rem', fontSize: '0.92rem', justifyContent: 'center' }}>
            {loggingIn ? 'Verifying…' : 'Sign in'}
          </button>
          <p style={{ margin: 0, color: C.ink3, fontSize: '0.72rem', textAlign: 'center' }}>Secured with password + device biometric.</p>
        </form>
      </div>
    );
  }

  // ===================== DASHBOARD =====================
  const pending = agencies.filter((a) => a.reviewStatus === 'pending');
  const fmtTime = clock.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const fmtDate = clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const navItem = (key: typeof tab, label: string, icon: string, badge?: number) => {
    const active = tab === key;
    return (
      <button key={key} type="button" onClick={() => { setTab(key); setDetail(null); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', textAlign: 'left',
          background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
          color: active ? '#fff' : SIDE_INK, borderRadius: 8, padding: '0.6rem 0.7rem', cursor: 'pointer',
          fontSize: '0.88rem', fontWeight: active ? 600 : 500, position: 'relative',
          border: 'none', borderLeft: `2px solid ${active ? C.accent : 'transparent'}`,
        }}>
        <Icon name={icon} size={17} />
        <span style={{ flex: 1 }}>{label}</span>
        {badge ? <span style={{ background: C.accent, color: '#fff', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, padding: '0.05rem 0.4rem' }}>{badge}</span> : null}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, color: C.ink, fontFamily: 'Inter, -apple-system, system-ui, sans-serif', display: 'flex' }}>
      {/* sidebar */}
      <aside style={{ width: 244, flexShrink: 0, background: C.sidebar, color: '#fff', padding: '1.3rem 0.85rem', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0 0.4rem 1.3rem', borderBottom: `1px solid ${C.sidebarPanel}` }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
            <BrandLogo variant="mark" height={24} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>RayHealth</div>
          <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: SIDE_INK_DIM, border: `1px solid ${C.sidebarPanel}`, borderRadius: 5, padding: '0.1rem 0.35rem' }}>ADMIN</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '1rem' }}>
          <div style={{ color: SIDE_INK_DIM, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.09em', padding: '0 0.7rem 0.4rem' }}>MONITOR</div>
          {navItem('overview', 'Overview', 'overview')}
          {navItem('agencies', 'Agencies', 'agencies', pending.length || undefined)}
          {navItem('users', 'Users', 'users')}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: SIDE_INK_DIM, padding: '0 0.6rem 0.9rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: '#34d399' }} />Live · refreshes every 30s
          </div>
          <div style={{ background: C.sidebarPanel, borderRadius: 10, padding: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>{CEO_INITIALS}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CEO_NAME}</div>
              <div style={{ fontSize: '0.7rem', color: SIDE_INK }}>{CEO_TITLE}</div>
            </div>
            <button type="button" onClick={logout} title="Sign out" style={{ background: 'transparent', border: 'none', color: SIDE_INK, cursor: 'pointer', padding: 4, display: 'flex' }}><Icon name="logout" size={17} /></button>
          </div>
        </div>
      </aside>

      {/* main */}
      <main style={{ flex: 1, minWidth: 0, padding: '1.6rem 2.1rem 3rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 650, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{greeting()}, Durga</div>
            <div style={{ color: C.ink2, fontSize: '0.88rem', marginTop: '0.3rem' }}>Everything across the platform, in one place.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.15rem', fontWeight: 650, color: C.ink }}>{fmtTime}</div>
              <div style={{ color: C.ink3, fontSize: '0.76rem' }}>{fmtDate}</div>
            </div>
            <button type="button" onClick={() => void load()} style={btn('default')} title={lastSync ? `Synced ${timeAgo(lastSync.toISOString())}` : 'Refresh'}>
              <Icon name="refresh" size={15} />Refresh
            </button>
          </div>
        </header>

        {pending.length > 0 && (
          <div style={{ background: C.amberSoft, border: `1px solid ${C.amber}33`, borderRadius: 10, padding: '0.75rem 1.05rem', marginBottom: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem' }}>
            <span style={{ color: C.amber, display: 'flex' }}><Icon name="alert" size={17} /></span>
            <span style={{ color: C.ink, fontWeight: 600 }}>{pending.length} agenc{pending.length === 1 ? 'y' : 'ies'} awaiting your review</span>
            <button type="button" onClick={() => setTab('agencies')} style={{ ...btn('ghost'), marginLeft: 'auto', borderColor: `${C.amber}55`, color: C.amber }}>Review</button>
          </div>
        )}

        {loadErr && <div role="alert" style={{ color: C.red, background: C.redSoft, border: `1px solid ${C.red}22`, borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1rem' }}>{loadErr}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(208px, 1fr))', gap: '0.85rem', marginBottom: '1.6rem' }}>
          <Kpi label="Agencies" icon="agencies" value={String(stats?.agencies.total ?? '—')} sub={`${stats?.agencies.approved ?? 0} active · ${stats?.agencies.pending ?? 0} pending`} subTone={(stats?.agencies.pending ?? 0) > 0 ? C.amber : undefined} />
          <Kpi label="Users" icon="users" value={String(stats?.users.total ?? '—')} sub={`${stats?.users.suspended ?? 0} suspended`} subTone={(stats?.users.suspended ?? 0) > 0 ? C.red : undefined} />
          <Kpi label="Clients" icon="client" value={String(stats?.clients ?? '—')} sub="across all agencies" />
          <Kpi label="Caregivers" icon="caregiver" value={String(stats?.caregivers.total ?? '—')} sub={`${stats?.caregivers.active ?? 0} active`} />
          <Kpi label="Visits today" icon="visit" value={String(stats?.visits.today ?? '—')} sub={`${stats?.visits.last7d ?? 0} this week · ${stats?.visits.total ?? 0} all-time`} />
          <Kpi label="Open exceptions" icon="alert" value={String(stats?.exceptions.open ?? '—')} sub="awaiting resolution" subTone={(stats?.exceptions.open ?? 0) > 0 ? C.amber : C.green} />
          <Kpi label="Claims" icon="claim" value={String(stats?.claims.total ?? '—')} sub={`${money(stats?.claims.chargedCents ?? 0)} billed`} />
          <Kpi label="Collected" icon="money" value={money(stats?.claims.paidCents ?? 0)} sub="remittances posted" subTone={C.green} />
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Panel title="Needs your attention">
                {pending.length === 0 ? <Empty>All clear — no agencies awaiting review.</Empty> : pending.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: `1px solid ${C.line}` }}>
                    <div>
                      <div style={{ fontWeight: 600, color: C.ink, fontSize: '0.9rem' }}>{a.name}</div>
                      <div style={{ color: C.ink2, fontSize: '0.78rem' }}>{a.adminEmails.join(', ') || 'no admin email'} · {timeAgo(a.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn('primary')}>Approve</button>
                      <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn('danger')}>Reject</button>
                    </div>
                  </div>
                ))}
              </Panel>
              <Panel title="Team by role">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem 0' }}>
                  {stats && Object.entries(stats.users.byRole).map(([role, n]) => (
                    <div key={role} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                      <span style={{ color: C.ink2, fontSize: '0.78rem', textTransform: 'capitalize' }}>{role}</span>
                    </div>
                  ))}
                  {(!stats || Object.keys(stats.users.byRole).length === 0) && <Empty>No users yet.</Empty>}
                </div>
              </Panel>
            </div>
            <Panel title="Live activity" action={<span style={{ color: C.ink3, fontSize: '0.72rem' }}>{activity.length} events</span>} scroll>
              {activity.length === 0 ? <Empty>No recent activity.</Empty> : activity.map((ev) => <ActivityItem key={ev.id} ev={ev} />)}
            </Panel>
          </div>
        )}

        {tab === 'agencies' && (detail ? (
          <AgencyDetailView detail={detail} busy={busy} onBack={() => setDetail(null)} onReview={reviewAgency} onToggleSuspend={toggleSuspend} />
        ) : (
          <Panel title={`All agencies (${agencies.length})`}>
            {agencies.length === 0 ? <Empty>No agencies yet.</Empty> : agencies.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.8rem 0', borderBottom: `1px solid ${C.line}`, cursor: 'pointer' }} onClick={() => openDetail(a.id)}>
                <div>
                  <div style={{ fontWeight: 600, color: C.ink, fontSize: '0.9rem' }}>{a.name} <span style={{ color: C.ink3, fontWeight: 400, fontSize: '0.8rem' }}>· {a.state}</span></div>
                  <div style={{ color: C.ink2, fontSize: '0.78rem', marginTop: '0.15rem' }}>{a.adminEmails.join(', ') || 'no admin email'} · {a.userCount} users · {a.clientCount} clients · {timeAgo(a.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <StatusBadge status={a.reviewStatus} />
                  {a.reviewStatus !== 'approved' && <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'approve')} style={btn('primary')}>Approve</button>}
                  {a.reviewStatus !== 'rejected' && <button type="button" disabled={busy === a.id} onClick={() => reviewAgency(a.id, 'reject')} style={btn('danger')}>Reject</button>}
                  <span style={{ color: C.ink3, display: 'flex' }}><Icon name="chevron" size={16} /></span>
                </div>
              </div>
            ))}
          </Panel>
        ))}

        {tab === 'users' && (
          <Panel title={`All users (${users.length})`}>
            {users.length === 0 ? <Empty>No users yet.</Empty> : users.map((u) => <UserRowView key={u.id} u={u} busy={busy === u.id} onToggle={() => toggleSuspend(u)} />)}
          </Panel>
        )}

        <footer style={{ marginTop: '2.5rem', color: C.ink3, fontSize: '0.74rem' }}>
          RayHealth Platform Command · {CEO_NAME} · every action is audit-logged
        </footer>
      </main>
    </div>
  );
}

function AgencyDetailView({ detail, busy, onBack, onReview, onToggleSuspend }: {
  detail: AgencyDetail; busy: string | null; onBack: () => void;
  onReview: (id: string, a: 'approve' | 'reject') => void; onToggleSuspend: (u: UserRow) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={btn('ghost')}><Icon name="back" size={15} />All agencies</button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: C.ink, letterSpacing: '-0.01em' }}>{detail.name}</h2>
        <StatusBadge status={detail.reviewStatus} />
        <span style={{ color: C.ink2, fontSize: '0.8rem' }}>{detail.state} · signed up {timeAgo(detail.createdAt)}{detail.reviewedBy ? ` · reviewed by ${detail.reviewedBy}` : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem' }}>
          {detail.reviewStatus !== 'approved' && <button type="button" disabled={busy === detail.id} onClick={() => onReview(detail.id, 'approve')} style={btn('primary')}>Approve</button>}
          {detail.reviewStatus !== 'rejected' && <button type="button" disabled={busy === detail.id} onClick={() => onReview(detail.id, 'reject')} style={btn('danger')}>Reject</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem' }}>
        <Kpi label="Users" icon="users" value={String(detail.userCount)} />
        <Kpi label="Clients" icon="client" value={String(detail.clientCount)} />
        <Kpi label="Caregivers" icon="caregiver" value={String(detail.caregiverCount)} />
        <Kpi label="Visits" icon="visit" value={String(detail.visitCount)} />
        <Kpi label="Claims" icon="claim" value={String(detail.claimCount)} sub={money(detail.chargedCents)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
        <Panel title={`Users (${detail.users.length})`} scroll>
          {detail.users.length === 0 ? <Empty>No users.</Empty> : detail.users.map((u) => <UserRowView key={u.id} u={u} busy={busy === u.id} onToggle={() => onToggleSuspend(u)} />)}
        </Panel>
        <Panel title="Recent activity" scroll>
          {detail.recentActivity.length === 0 ? <Empty>No activity.</Empty> : detail.recentActivity.map((ev) => <ActivityItem key={ev.id} ev={ev} />)}
        </Panel>
      </div>
    </div>
  );
}
