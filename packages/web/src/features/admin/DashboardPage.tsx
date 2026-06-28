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

const svg = (children: React.ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  client: svg(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  staff: svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  template: svg(<><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>),
  calendar: svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>),
  training: svg(<><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" /></>),
  key: svg(<><path d="M21 2l-2 2m-3.5 3.5a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L19 4l3 3-3.5 3.5" /></>),
  shield: svg(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  audit: svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>),
  mobile: svg(<><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="18" x2="15" y2="18" /></>),
};

const quickActions = [
  {
    title: 'Add a new client',
    body: 'Capture demographics, Medicaid ID, and authorizations in one step.',
    to: '/admin/clients',
    cta: 'Open clients',
    icon: ICONS.client,
    tint: '#4F46E5',
    tintBg: 'rgba(79,70,229,0.08)',
  },
  {
    title: 'Invite staff',
    body: 'Send a credential-aware invite with the right capability scope.',
    to: '/admin/staff',
    cta: 'Open staff',
    icon: ICONS.staff,
    tint: '#2563EB',
    tintBg: 'rgba(37,99,235,0.08)',
  },
  {
    title: 'Build a visit template',
    body: 'Compose PA-coded tasks once, reuse across clients and shifts.',
    to: '/admin/templates',
    cta: 'Open templates',
    icon: ICONS.template,
    tint: '#0891B2',
    tintBg: 'rgba(8,145,178,0.08)',
  },
  {
    title: 'Schedule the week',
    body: 'Assign caregivers to authorizations with eligibility checks.',
    to: '/admin/assignments',
    cta: 'Open assignments',
    icon: ICONS.calendar,
    tint: '#16A34A',
    tintBg: 'rgba(22,163,74,0.08)',
  },
  {
    title: 'Review training compliance',
    body: 'PA §52.18 rollup with overdue and expiring certification alerts.',
    to: '/admin/learning',
    cta: 'Open Learning Hub',
    icon: ICONS.training,
    tint: '#D97706',
    tintBg: 'rgba(217,119,6,0.08)',
  },
];

const securityHighlights = [
  { label: 'Auth method', value: 'HttpOnly cookie session', icon: ICONS.key },
  { label: 'CSRF protection', value: 'Double-submit token, rotated on /me', icon: ICONS.shield },
  { label: 'Audit trail', value: 'auth.login · session.revoked · csrf.failure', icon: ICONS.audit },
  { label: 'Mobile auth', value: 'expo-secure-store, never in plain JS', icon: ICONS.mobile },
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
      ? '#16A34A'
      : '#DC2626';

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
      tint: '#4F46E5',
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
      tint: '#2563EB',
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
      tint: '#0891B2',
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
      tint: '#16A34A',
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

      {/* Header */}
      <div style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        padding: '1.75rem 2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.625rem',
              fontWeight: 700,
              color: '#0F172A',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              {timeGreeting}{displayName ? `, ${displayName}` : ''}
            </h1>
            <p style={{ margin: '0.35rem 0 0', color: '#64748B', fontSize: '0.9375rem' }}>
              {todayStr}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: '#F0FDF4', borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem', fontWeight: 600,
              color: '#15803D',
              border: '1px solid #BBF7D0',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
              Secure session
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              background: '#F1F5F9', borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem', fontWeight: 600,
              color: '#475569', letterSpacing: '0.04em',
              textTransform: 'capitalize',
              border: '1px solid #E2E8F0',
            }}>
              {roleLabel}
            </span>
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
                    color: q.tint,
                    display: 'grid', placeItems: 'center',
                    flexShrink: 0,
                  }} aria-hidden>
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
          backgroundColor: '#fff',
          borderRadius: '14px',
          padding: '1.75rem 2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1.5rem',
          border: '1px solid #E2E8F0',
        }}>
          {securityHighlights.map((h) => (
            <div key={h.label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{
                width: '34px', height: '34px', borderRadius: '8px',
                backgroundColor: '#F1F5F9', color: '#475569',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }} aria-hidden>{h.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{
                  fontSize: '0.65rem', letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700,
                }}>
                  {h.label}
                </span>
                <span style={{ fontSize: '0.875rem', lineHeight: 1.5, color: '#334155', fontWeight: 500 }}>
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
