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
    body: 'Capture demographics, Medicaid id, and authorizations in one step.',
    to: '/admin/clients',
    cta: 'Open clients',
  },
  {
    title: 'Invite a coordinator or caregiver',
    body: 'Send a credential-aware invite with the right capability scope.',
    to: '/admin/staff',
    cta: 'Open staff',
  },
  {
    title: 'Build a visit template',
    body: 'Compose PA-coded tasks once, reuse across clients and shifts.',
    to: '/admin/templates',
    cta: 'Open templates',
  },
  {
    title: 'Schedule the week',
    body: 'Assign credentialed caregivers to authorizations with eligibility checks.',
    to: '/admin/assignments',
    cta: 'Open assignments',
  },
  {
    title: 'Review training compliance',
    body: 'PA §52.18 caregiver training rollup with overdue and expiring certification alerts.',
    to: '/admin/learning',
    cta: 'Open Learning Hub',
  },
];

const securityHighlights = [
  { label: 'Auth method', value: 'HttpOnly cookie session' },
  { label: 'CSRF protection', value: 'Double-submit token, rotated on each /me' },
  { label: 'Audit trail', value: 'auth.login • session.revoked • csrf.failure' },
  { label: 'Mobile auth', value: 'expo-secure-store, never in plain JS' },
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

    return () => {
      cancelled = true;
    };
  }, []);

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const roleLabel = user?.role ?? 'admin';

  const complianceDisplay = counts.complianceRate === null ? '—' : `${counts.complianceRate}%`;
  const complianceTint = counts.complianceRate === null
    ? '#94A3B8'
    : counts.complianceRate >= 80
      ? '#10B981'
      : '#F43F5E';

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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Visits this period',
      value: formatCount(counts.visits),
      tint: '#10B981',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-header__title">
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {timeGreeting}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#4F46E5',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              {roleLabel}
            </span>
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.95rem', maxWidth: '640px' }}>
            Here&apos;s what&apos;s happening at your agency today.
          </p>
        </div>
      </header>

      {/* Stats */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: `${s.tint}1A`,
                color: s.tint,
                display: 'grid',
                placeItems: 'center',
                marginBottom: '0.85rem',
              }}
              aria-hidden
            >
              {s.icon}
            </div>
            <div
              style={{
                fontSize: '1.875rem',
                fontWeight: 700,
                color: '#0F172A',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: '#64748B',
                marginTop: '0.4rem',
                fontWeight: 500,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>Quick actions</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {quickActions.map((q) => (
            <Link
              key={q.title}
              to={q.to}
              className="action-card"
              style={{ textDecoration: 'none' }}
            >
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                {q.title}
              </h3>
              <p style={{ margin: 0, color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.5, flex: 1 }}>
                {q.body}
              </p>
              <span
                style={{
                  marginTop: '0.25rem',
                  color: '#6366F1',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                {q.cta}
                <span aria-hidden>&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Security highlights */}
      <section>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>Security posture</h2>
        <div
          style={{
            backgroundColor: '#0F172A',
            backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(99,102,241,0.15) 0%, transparent 60%)',
            color: 'white',
            borderRadius: '12px',
            padding: '1.75rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            border: '1px solid #1E293B',
          }}
        >
          {securityHighlights.map((h) => (
            <div key={h.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#94A3B8',
                  fontWeight: 600,
                }}
              >
                {h.label}
              </span>
              <span style={{ fontSize: '0.875rem', lineHeight: 1.5, color: '#E2E8F0' }}>{h.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
