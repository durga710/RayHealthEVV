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

function StatusBadge({ status }: { status: EvvVisit['status'] }) {
  const map = {
    verified: { bg: '#F0FDF4', color: '#16A34A', label: 'Verified' },
    pending:  { bg: '#FFFBEB', color: '#D97706', label: 'Pending' },
    flagged:  { bg: '#FEF2F2', color: '#DC2626', label: 'Flagged' },
  };
  const s = map[status];
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: s.bg, color: s.color, borderRadius: '100px', padding: '0.15rem 0.55rem' }}>
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

  if (loading) {
    return <div style={{ color: '#64748B', padding: '2rem' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>
        {greeting}, {firstName}
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '2rem' }}>
        Here's your activity overview
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
        {[
          { label: 'Hours this week', value: formatHours(weekHours), sub: 'completed shifts' },
          { label: 'Visits this month', value: String(monthVisits), sub: 'completed visits' },
          { label: 'Total hours worked', value: formatHours(totalHours), sub: 'all time' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.1 }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>Recent Visits</h2>
            <Link to="/portal/visits" style={{ fontSize: '0.8125rem', color: 'var(--color-primary, #6366F1)', textDecoration: 'none', fontWeight: 500 }}>
              View all
            </Link>
          </div>
          {recentVisits.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>No visits yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentVisits.map((v) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1E293B' }}>
                      {new Date(v.clockInTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                      {new Date(v.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {v.clockOutTime && ` – ${new Date(v.clockOutTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                      {v.clockOutTime && ` (${formatHours(hoursFromVisit(v))})`}
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>My Assignments</h2>
            <Link to="/portal/schedule" style={{ fontSize: '0.8125rem', color: 'var(--color-primary, #6366F1)', textDecoration: 'none', fontWeight: 500 }}>
              View all
            </Link>
          </div>
          {assignments.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>No assignments</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {assignments.slice(0, 5).map((a) => (
                <div key={a.id} style={{ fontSize: '0.8125rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.6rem' }}>
                  <div style={{ fontWeight: 500, color: '#1E293B' }}>{a.clientName}</div>
                  {a.serviceCode && (
                    <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Service: {a.serviceCode}
                    </div>
                  )}
                </div>
              ))}
              {assignments.length > 5 && (
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>+{assignments.length - 5} more</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
