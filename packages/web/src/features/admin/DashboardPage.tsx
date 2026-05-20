import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson } from '../../lib/api-client.js';

interface CountState {
  clients: number | null;
  staff: number | null;
  assignments: number | null;
  visits: number | null;
  complianceRate: number | null;
}

const initialCounts: CountState = {
  clients: null,
  staff: null,
  assignments: null,
  visits: null,
  complianceRate: null,
};

function formatCount(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat().format(value);
}

const quickActions = [
  {
    title: 'Add a new client',
    body: 'Capture demographics, Medicaid ID, and authorizations in one step.',
    to: '/admin/clients',
    cta: 'Open clients',
    icon: '👤',
    tint: '#6366F1',
    tintBg: 'rgba(99,102,241,0.1)',
  },
  {
    title: 'Invite staff',
    body: 'Send a credential-aware invite with the right capability scope.',
    to: '/admin/staff',
    cta: 'Open staff',
    icon: '👥',
    tint: '#8B5CF6',
    tintBg: 'rgba(139,92,246,0.1)',
  },
  {
    title: 'Build a visit template',
    body: 'Compose PA-coded tasks once, reuse across clients and shifts.',
    to: '/admin/templates',
    cta: 'Open templates',
    icon: '📋',
    tint: '#0EA5E9',
    tintBg: 'rgba(14,165,233,0.1)',
  },
  {
    title: 'Schedule the week',
    body: 'Assign caregivers to authorizations with eligibility checks.',
    to: '/admin/assignments',
    cta: 'Open assignments',
    icon: '📅',
    tint: '#10B981',
    tintBg: 'rgba(16,185,129,0.1)',
  },
  {
    title: 'Review training compliance',
    body: 'PA §52.18 rollup with overdue and expiring certification alerts.',
    to: '/admin/learning',
    cta: 'Open Learning Hub',
    icon: '🎓',
    tint: '#F59E0B',
    tintBg: 'rgba(245,158,11,0.1)',
  },
];

const securityHighlights = [
  { label: 'Auth method', value: 'HttpOnly cookie session', icon: '🔑' },
  { label: 'CSRF protection', value: 'Double-submit token, rotated on /me', icon: '🛡️' },
  { label: 'Audit trail', value: 'auth.login · session.revoked · csrf.failure', icon: '📜' },
  { label: 'Mobile auth', value: 'expo-secure-store, never in plain JS', icon: '📱' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<CountState>(initialCounts);

  useEffect(() => {
    let cancelled = false;

    const safeCount = async <T,>(path: string): Promise<number | null> => {
      try {
        const data = await getJson<T[] | { items: T[] }>(path);
        if (Array.isArray(data)) return data.length;
        if (data && Array.isArray((data as { items: T[] }).items)) {
          return (data as { items: T[] }).items.length;
        }
        return 0;
      } catch {
        return null;
      }
    };

    const safeRollup = async (): Promise<number | null> => {
      try {
        const res = await getJson<{ success: boolean; data: { complianceRate: number } }>('/api/learning/rollup');
        return res.success ? Math.round(res.data.complianceRate * 100) : null;
      } catch {
        return null;
      }
    };

    Promise.all([
      safeCount('/api/clients'),
      safeCount('/api/staff'),
      safeCount('/api/assignments'),
      safeCount('/api/evv/visits'),
      safeRollup(),
    ]).then(([clients, staff, assignments, visits, complianceRate]) => {
      if (cancelled) return;
      setCounts({ clients, staff, assignments, visits, complianceRate });
    });

    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const roleLabel = user?.role ?? 'admin';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '';

  const complianceDisplay = counts.complianceRate === null ? '—' : `${counts.complianceRate}%`;
  const complianceTint = counts.complianceRate === null
    ? '#94A3B8'
    : counts.complianceRate >= 80
      ? '#10B981'
      : '#F43F5E';

  const todayStr = new Date().toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  type StatTile = {
    label: string;
    value: string;
    tint: string;
    icon: React.ReactElement;
  };

  const stats: StatTile[] = [
    {
      label: 'Active clients',
      value: formatCount(counts.clients),
      tint: '#6366F1',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: 'Staff & caregivers',
      value: formatCount(counts.staff),
      tint: '#8B5CF6',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
      ),
    },
    {
      label: 'Open assignments',
      value: formatCount(counts.assignments),
      tint: '#0EA5E9',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
      ),
    },
    {
      label: 'Visits this period',
      value: formatCount(counts.visits),
      tint: '#10B981',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      label: 'Training compliance',
      value: complianceDisplay,
      tint: complianceTint,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2d52 0%, #1a5fa8 60%, #2d7dd2 100%)',
        borderRadius: '16px',
        padding: '2rem 2.25rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', top: '-30%', right: '-10%',
          width: '50%', height: '200%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div aria-hidden style={{
          position: 'absolute', bottom: '-40%', left: '20%',
          width: '40%', height: '150%',
          background: 'radial-gradient(circle, rgba(45,125,210,0.3) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: '#4ade80',
                boxShadow: '0 0 0 3px rgba(74,222,128,0.3)',
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(212,232,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Secure session active
              </span>
            </div>
            <h1 style={{
              margin: 0,
              fontSize: '1.875rem',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              {timeGreeting}{displayName ? `, ${displayName}` : ''}
            </h1>
            <p style={{ margin: '0.4rem 0 0', color: 'rgba(144,189,224,0.9)', fontSize: '0.9375rem' }}>
              {todayStr}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.12)', borderRadius: '999px',
              padding: '0.3rem 0.85rem',
              fontSize: '0.7rem', fontWeight: 700,
              color: '#bfdbfe', letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              {roleLabel}
            </span>
            {counts.visits !== null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(16,185,129,0.15)', borderRadius: '999px',
                padding: '0.3rem 0.85rem',
                fontSize: '0.7rem', fontWeight: 700,
                color: '#6ee7b7', letterSpacing: '0.06em',
                border: '1px solid rgba(16,185,129,0.25)',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80', display: 'inline-block' }} />
                {formatCount(counts.visits)} visits recorded
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <section>
        <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Overview
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: '0.75rem',
        }}>
          {stats.map((s) => (
            <div
              key={s.label}
              className="stat-card"
              style={{ borderTop: `3px solid ${s.tint}` }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                backgroundColor: `${s.tint}18`,
                color: s.tint,
                display: 'grid', placeItems: 'center',
                marginBottom: '1rem',
              }} aria-hidden>
                {s.icon}
              </div>
              <div style={{
                fontSize: '2rem', fontWeight: 800,
                color: '#0F172A', lineHeight: 1,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.35rem', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Quick actions
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.75rem',
        }}>
          {quickActions.map((q) => (
            <Link key={q.title} to={q.to} style={{ textDecoration: 'none', display: 'flex' }}>
              <div className="action-card" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    backgroundColor: q.tintBg,
                    display: 'grid', placeItems: 'center',
                    fontSize: '1.25rem', flexShrink: 0,
                  }}>
                    {q.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                      {q.title}
                    </h3>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.55 }}>
                      {q.body}
                    </p>
                  </div>
                </div>
                <span style={{
                  marginTop: '0.75rem',
                  color: q.tint,
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}>
                  {q.cta} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Security posture */}
      <section>
        <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Security posture
        </h2>
        <div style={{
          backgroundColor: '#0F172A',
          backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(circle at 5% 90%, rgba(14,165,233,0.12) 0%, transparent 50%)',
          borderRadius: '14px',
          padding: '1.75rem 2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1.5rem',
          border: '1px solid #1E293B',
        }}>
          {securityHighlights.map((h) => (
            <div key={h.label} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.125rem', marginTop: '1px', flexShrink: 0 }}>{h.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{
                  fontSize: '0.65rem', letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#64748B', fontWeight: 700,
                }}>
                  {h.label}
                </span>
                <span style={{ fontSize: '0.875rem', lineHeight: 1.5, color: '#E2E8F0', fontWeight: 500 }}>
                  {h.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
