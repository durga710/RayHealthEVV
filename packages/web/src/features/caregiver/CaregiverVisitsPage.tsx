import { useState, useEffect } from 'react';
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

function hoursFromVisit(v: EvvVisit): number {
  if (!v.clockOutTime) return 0;
  return (new Date(v.clockOutTime).getTime() - new Date(v.clockInTime).getTime()) / 3_600_000;
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    verified:  { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Verified' },
    pending:   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', label: 'Pending' },
    flagged:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Flagged' },
    corrected: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', label: 'Corrected' },
  };
  const s = map[status] ?? { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', label: status || 'Unknown' };
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
      {s.label}
    </span>
  );
}

type Filter = 'all' | 'verified' | 'pending' | 'flagged';

export function CaregiverVisitsPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    getJson<EvvVisit[]>('/api/evv/visits')
      .then((v) => setVisits([...v].sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())))
      .catch(() => setError('Failed to load visits'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? visits : visits.filter((v) => v.status === filter);
  const totalHours = visits.filter((v) => v.clockOutTime).reduce((s, v) => s + hoursFromVisit(v), 0);
  const counts: Record<Filter, number> = {
    all: visits.length,
    verified: visits.filter((v) => v.status === 'verified').length,
    pending: visits.filter((v) => v.status === 'pending').length,
    flagged: visits.filter((v) => v.status === 'flagged').length,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--color-primary, #107480)' : 'transparent',
    color: active ? '#fff' : '#64748B',
  });

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>
            My Visits
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Your complete EVV visit history
          </p>
        </div>
        {visits.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>{formatHours(totalHours)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>total hours worked</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.25rem' }}>
        {(['all', 'verified', 'pending', 'flagged'] as Filter[]).map((f) => (
          <button key={f} type="button" style={tabStyle(filter === f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#64748B' }}>Loading…</div>}
      {error && <div style={{ color: '#EF4444' }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: '#94A3B8' }}>
          No visits found
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map((v) => {
            const hours = hoursFromVisit(v);
            const dateStr = new Date(v.clockInTime).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            });
            const inTime = new Date(v.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const outTime = v.clockOutTime
              ? new Date(v.clockOutTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : null;

            return (
              <div
                key={v.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>{dateStr}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.15rem' }}>
                    {inTime}
                    {outTime ? `, ${outTime}` : ' (in progress)'}
                    {v.serviceCode && ` · ${v.serviceCode}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>
                    {hours > 0 ? formatHours(hours) : '-'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>duration</div>
                </div>
                <StatusBadge status={v.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
