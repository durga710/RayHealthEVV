import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';
import { getJson } from '../../lib/api-client.js';

interface EvvVisit {
  id: string;
  assignmentId: string;
  clientId?: string;
  serviceCode?: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged';
}

interface Assignment {
  id: string;
  clientId: string;
  clientName: string;
  serviceCode?: string;
}

function hoursFromVisit(visit: EvvVisit): number {
  if (!visit.clockOutTime) return 0;
  return (new Date(visit.clockOutTime).getTime() - new Date(visit.clockInTime).getTime()) / 3_600_000;
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return d >= weekStart && d <= now;
}

function isThisMonth(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    verified:  { bg: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'var(--color-success-border)', label: 'Verified' },
    pending:   { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: 'var(--color-warning-border)', label: 'Pending' },
    flagged:   { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: 'var(--color-danger-border)', label: 'Flagged' },
    corrected: { bg: 'var(--color-info-bg)', color: 'var(--color-primary)', border: 'var(--color-info-border)', label: 'Corrected' },
  };
  const fallback = { bg: 'var(--color-surface-soft)', color: 'var(--color-text-secondary)', border: 'var(--color-border)', label: status || 'Unknown' };
  const s = map[status] ?? fallback;
  return (
    <span style={{
      fontSize: '0.6875rem',
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: '100px',
      padding: '0.15rem 0.55rem',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export function CaregiverDashboard() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      getJson<EvvVisit[]>('/api/evv/visits').catch(() => [] as EvvVisit[]),
      getJson<Assignment[]>('/api/assignments/caregiver').catch(() => [] as Assignment[]),
    ]).then(([v, a]) => {
      setVisits(v);
      setAssignments(a);
      setLoading(false);
    });
  }, []);

  const completedVisits = visits.filter((v) => v.clockOutTime);
  const weekHours = completedVisits
    .filter((v) => isThisWeek(v.clockInTime))
    .reduce((s, v) => s + hoursFromVisit(v), 0);
  const monthVisits = completedVisits.filter((v) => isThisMonth(v.clockInTime)).length;
  const totalHours = completedVisits.reduce((s, v) => s + hoursFromVisit(v), 0);
  const recentVisits = [...visits]
    .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())
    .slice(0, 5);

  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div style={{ maxWidth: '900px' }}>
        <style>{`@keyframes rh-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 60%, var(--color-primary) 100%)',
          borderRadius: '16px',
          height: '100px',
          marginBottom: '1.75rem',
          animation: 'rh-pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              animation: 'rh-pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ background: 'var(--color-surface-soft)', borderRadius: '6px', height: '10px', width: '55%', marginBottom: '0.85rem' }} />
              <div style={{ background: 'var(--color-border)', borderRadius: '6px', height: '28px', width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats: Array<{
    label: string;
    value: string;
    sub: string;
    accent: string;
    iconBg: string;
    icon: React.ReactNode;
  }> = [
    {
      label: 'Hours This Week',
      value: formatHours(weekHours),
      sub: 'completed shifts',
      accent: 'var(--color-primary)',
      iconBg: 'rgba(99,102,241,0.10)',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'Visits This Month',
      value: String(monthVisits),
      sub: 'completed visits',
      accent: 'var(--color-success)',
      iconBg: 'rgba(16,185,129,0.10)',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      label: 'Total Hours Worked',
      value: formatHours(totalHours),
      sub: 'all time',
      accent: 'var(--color-primary)',
      iconBg: 'rgba(14,165,233,0.10)',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '900px' }}>

      {/* ── Hero banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 60%, var(--color-primary) 100%)',
        borderRadius: '16px',
        padding: '2rem 2.25rem',
        marginBottom: '1.75rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute',
          right: '-3rem',
          top: '-3rem',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-surface)', margin: '0 0 0.3rem', lineHeight: 1.2 }}>
          {greeting}, {firstName}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)', margin: 0 }}>
          {todayStr} · Here's your activity overview
        </p>
      </div>

      {/* ── Stat tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderTop: `3px solid ${stat.accent}`,
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              transition: 'box-shadow 0.15s, transform 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(15,23,42,0.10)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--color-text-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                lineHeight: 1.4,
              }}>
                {stat.label}
              </div>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: stat.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginLeft: '0.5rem',
              }}>
                {stat.icon}
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, marginBottom: '0.3rem' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Cards row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>

        {/* Recent Visits card */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid var(--color-surface-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--color-text-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.2rem',
              }}>
                Recent Activity
              </div>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Recent Visits</h2>
            </div>
            <Link
              to="/portal/visits"
              style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              View all →
            </Link>
          </div>

          <div style={{ padding: '0.25rem 0' }}>
            {recentVisits.length === 0 ? (
              <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.875rem', margin: 0, padding: '1rem 1.25rem' }}>No visits yet</p>
            ) : (
              recentVisits.map((v, idx) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.625rem 1.25rem',
                    borderBottom: idx < recentVisits.length - 1 ? '1px solid var(--color-bg)' : 'none',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-slate-800)' }}>
                      {new Date(v.clockInTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                      {new Date(v.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {v.clockOutTime && `, ${new Date(v.clockOutTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                      {v.clockOutTime && ` (${formatHours(hoursFromVisit(v))})`}
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Assignments card */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid var(--color-surface-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--color-text-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.2rem',
              }}>
                Assigned Clients
              </div>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>My Assignments</h2>
            </div>
            <Link
              to="/portal/schedule"
              style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              View all →
            </Link>
          </div>

          <div style={{ padding: '0.25rem 0' }}>
            {assignments.length === 0 ? (
              <p style={{ color: 'var(--color-text-subtle)', fontSize: '0.875rem', margin: 0, padding: '1rem 1.25rem' }}>No assignments</p>
            ) : (
              <>
                {assignments.slice(0, 5).map((a, idx) => {
                  const initial = a.clientName.slice(0, 1).toUpperCase();
                  return (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.625rem 1.25rem',
                        borderBottom: idx < Math.min(assignments.length, 5) - 1 ? '1px solid var(--color-bg)' : 'none',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-surface)',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-slate-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.clientName}
                        </div>
                        {a.serviceCode && (
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                            {a.serviceCode}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {assignments.length > 5 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', padding: '0.5rem 1.25rem' }}>
                    +{assignments.length - 5} more
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
