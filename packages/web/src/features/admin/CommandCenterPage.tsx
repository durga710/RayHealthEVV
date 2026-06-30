import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson, postJson } from '../../lib/api-client.js';
import { ErrorRetry } from '../../components/state/index.js';

interface BriefingResponse {
  available: boolean;
  reason?: string;
  briefing?: string;
  provider?: string;
}

type Severity = 'critical' | 'warning' | 'info';

interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  count: number;
  to: string;
}

interface CommandCenterSummary {
  asOf: string;
  generatedAt: string;
  today: { scheduledToday: number; completed: number; inProgress: number; lateStart: number; upcoming: number };
  exceptions: { openExceptions: number };
  authorizations: { activeAuthorizations: number; expiringIn14d: number; recentlyExpired: number };
  credentials: { activeCredentials: number; expiringIn30d: number; recentlyExpired: number };
  claims: { verifiedVisitsLast7d: number; flaggedVisitsLast7d: number };
  payroll: { verifiedHoursLast7d: number; inProgressVisits: number };
  training: { complianceRate: number; overdue: number; expired: number };
  coverage: { totalGaps: number };
  attention: AttentionItem[];
}

const SEV: Record<Severity, { bg: string; border: string; color: string; dot: string; label: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', dot: '#DC2626', label: 'Critical' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', dot: '#D97706', label: 'Warning' },
  info: { bg: '#ECFEFF', border: '#A5F3FC', color: '#155E75', dot: '#0891B2', label: 'Info' },
};

function Kpi({ label, value, sub, tint, alert }: { label: string; value: string; sub?: string; tint: string; alert?: boolean }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${alert ? '#DC2626' : tint}` }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: alert ? '#DC2626' : '#0F172A', lineHeight: 1.1, marginTop: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.3rem' }}>{sub}</div>}
    </div>
  );
}

const quickActions = [
  { title: 'Schedule a visit', to: '/admin/assignments', cta: 'Open assignments' },
  { title: 'Add a client', to: '/admin/clients', cta: 'Open clients' },
  { title: 'Review visits', to: '/admin/review', cta: 'Open visit review' },
  { title: 'Generate claims', to: '/admin/compliance-engine/claims', cta: 'Open claims' },
];

export function CommandCenterPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const loadBriefing = useCallback(() => {
    setBriefingLoading(true);
    postJson<BriefingResponse>('/api/command-center/briefing', {})
      .then((b) => setBriefing(b))
      .catch(() => setBriefing({ available: false, reason: 'Could not generate a briefing right now.' }))
      .finally(() => setBriefingLoading(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<CommandCenterSummary>('/api/command-center/summary')
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message || 'Failed to load the command center'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh each minute — it's a live ops board
    return () => clearInterval(t);
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.firstName || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {greeting}{name ? `, ${name}` : ''}
          </h1>
          <p style={{ margin: '0.3rem 0 0', color: '#64748B', fontSize: '0.9375rem' }}>
            Command Center · here's what needs your attention today
          </p>
        </div>
        <button type="button" onClick={load} className="btn-ghost btn-sm" disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorRetry message={error} onRetry={load} />}

      {loading && !data && (
        <div style={{ color: '#64748B', padding: '2rem', textAlign: 'center' }}>Loading your agency…</div>
      )}

      {data && (
        <>
          {/* ── AI briefing (on-demand) ── */}
          <section
            style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: '14px',
              padding: '1.25rem 1.4rem',
              color: '#E2E8F0',
              // Crisp dark edge + clip so the gradient doesn't leave a light
              // antialiasing sliver at the rounded corners.
              border: '1px solid #1E293B',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span aria-hidden style={{ fontSize: '1.1rem' }}>✨</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8' }}>
                  AI briefing
                </span>
              </div>
              {!briefing?.available && (
                <button
                  type="button"
                  onClick={loadBriefing}
                  disabled={briefingLoading}
                  className="btn-sm"
                  style={{ background: '#14B8A6', color: '#04201D', border: 'none', borderRadius: '8px', fontWeight: 700, padding: '0.4rem 0.9rem', cursor: 'pointer' }}
                >
                  {briefingLoading ? 'Thinking…' : 'Summarize my day'}
                </button>
              )}
            </div>
            {briefing?.available && briefing.briefing && (
              <p style={{ margin: '0.85rem 0 0', fontSize: '0.95rem', lineHeight: 1.6, color: '#F1F5F9' }}>
                {briefing.briefing}
                <button
                  type="button"
                  onClick={loadBriefing}
                  disabled={briefingLoading}
                  style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#5EEAD4', fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem' }}
                >
                  {briefingLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </p>
            )}
            {briefing && !briefing.available && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#94A3B8' }}>
                {briefing.reason || 'AI briefing is not available.'}
              </p>
            )}
            {!briefing && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: '#94A3B8' }}>
                Get a plain-English summary of what to prioritize today.
              </p>
            )}
          </section>

          {/* ── Needs attention ── */}
          <section>
            <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Needs attention
            </h2>
            {data.attention.length === 0 ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#166534' }}>All clear</div>
                  <div style={{ fontSize: '0.8125rem', color: '#15803D' }}>
                    No late visits, open exceptions, or lapsed compliance right now.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {data.attention.map((item) => {
                  const s = SEV[item.severity];
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      style={{
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.9rem',
                        background: s.bg,
                        border: `1px solid ${s.border}`,
                        borderRadius: '10px',
                        padding: '0.85rem 1.1rem',
                      }}
                    >
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: s.color, fontSize: '0.9375rem' }}>{item.title}</div>
                        <div style={{ fontSize: '0.8125rem', color: s.color, opacity: 0.85 }}>{item.detail}</div>
                      </div>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: s.color, background: '#fff', border: `1px solid ${s.border}`,
                        borderRadius: '999px', padding: '0.15rem 0.55rem', whiteSpace: 'nowrap',
                      }}>
                        {s.label}
                      </span>
                      <span style={{ color: s.color, fontWeight: 700, flexShrink: 0 }}>→</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Today ── */}
          <section>
            <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Today
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              <Kpi label="Scheduled" value={String(data.today.scheduledToday)} sub="visits today" tint="#4F46E5" />
              <Kpi label="Completed" value={String(data.today.completed)} sub="clocked out" tint="#16A34A" />
              <Kpi label="In progress" value={String(data.today.inProgress)} sub="clocked in" tint="#0891B2" />
              <Kpi label="Late to start" value={String(data.today.lateStart)} sub="no clock-in" tint="#D97706" alert={data.today.lateStart > 0} />
              <Kpi label="Upcoming" value={String(data.today.upcoming)} sub="later today" tint="#64748B" />
            </div>
          </section>

          {/* ── Compliance & readiness ── */}
          <section>
            <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Compliance &amp; readiness
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
              <Kpi label="Open exceptions" value={String(data.exceptions.openExceptions)} sub="need resolution" tint="#D97706" alert={data.exceptions.openExceptions > 0} />
              <Kpi label="Auths expiring (14d)" value={String(data.authorizations.expiringIn14d)} sub={`${data.authorizations.activeAuthorizations} active`} tint="#7C3AED" />
              <Kpi label="Credentials expiring (30d)" value={String(data.credentials.expiringIn30d)} sub={`${data.credentials.recentlyExpired} expired`} tint="#BE185D" alert={data.credentials.recentlyExpired > 0} />
              <Kpi label="Training compliance" value={`${Math.round(data.training.complianceRate * 100)}%`} sub={`${data.training.overdue} overdue`} tint="#0EA5E9" alert={data.training.overdue > 0} />
              <Kpi label="Billing-ready (7d)" value={String(data.claims.verifiedVisitsLast7d)} sub={`${data.claims.flaggedVisitsLast7d} flagged`} tint="#16A34A" />
              <Kpi label="Verified hours (7d)" value={data.payroll.verifiedHoursLast7d.toFixed(1)} sub={`${data.payroll.inProgressVisits} open visits`} tint="#0F766E" alert={data.payroll.inProgressVisits > 0} />
              <Kpi label="Coverage gaps (14d)" value={String(data.coverage.totalGaps)} sub="not yet generated" tint="#D97706" alert={data.coverage.totalGaps > 0} />
            </div>
          </section>

          {/* ── Quick actions ── */}
          <section>
            <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Quick actions
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {quickActions.map((q) => (
                <Link key={q.to} to={q.to} style={{ textDecoration: 'none' }}>
                  <div className="action-card">
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>{q.title}</h3>
                    <span style={{ marginTop: '0.6rem', color: '#107480', fontWeight: 600, fontSize: '0.8125rem' }}>
                      {q.cta} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: 0 }}>
            As of {new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · auto-refreshes every minute
          </p>
        </>
      )}
    </div>
  );
}
