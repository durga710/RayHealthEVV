import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';
import { ErrorRetry, EmptyState, LoadingSkeleton } from '../../components/state/index.js';

type VisitStatus = 'late' | 'in_progress' | 'upcoming' | 'completed';

interface TodayVisit {
  assignmentId: string;
  clientName: string;
  caregiverName: string;
  scheduledStartTime: string | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  status: VisitStatus;
}

interface TodayBoard {
  generatedAt: string;
  counts: { scheduledToday: number; late: number; inProgress: number; upcoming: number; completed: number };
  visits: TodayVisit[];
}

type Filter = 'all' | VisitStatus;

const STATUS_META: Record<VisitStatus, { label: string; bg: string; border: string; color: string }> = {
  late: { label: 'Late to start', bg: '#FEF2F2', border: '#FECACA', color: '#991B1B' },
  in_progress: { label: 'In progress', bg: '#ECFEFF', border: '#A5F3FC', color: '#155E75' },
  upcoming: { label: 'Upcoming', bg: '#F1F5F9', border: '#E2E8F0', color: '#475569' },
  completed: { label: 'Completed', bg: '#F0FDF4', border: '#BBF7D0', color: '#166534' },
};

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }: { status: VisitStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.6875rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.border}`,
        borderRadius: '999px',
        padding: '0.15rem 0.55rem',
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

export function TodayBoardPage() {
  const [data, setData] = useState<TodayBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<TodayBoard>('/api/command-center/today')
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message || "Failed to load today's board"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // live ops board, refresh each minute
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.visits;
    return data.visits.filter((v) => v.status === filter);
  }, [data, filter]);

  const filterTabs: { key: Filter; label: string; count: number }[] = data
    ? [
        { key: 'all', label: 'All', count: data.counts.scheduledToday },
        { key: 'late', label: 'Late', count: data.counts.late },
        { key: 'in_progress', label: 'In progress', count: data.counts.inProgress },
        { key: 'upcoming', label: 'Upcoming', count: data.counts.upcoming },
        { key: 'completed', label: 'Completed', count: data.counts.completed },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
            <Link to="/admin" style={{ color: '#107480', textDecoration: 'none', fontWeight: 600 }}>
              ← Command Center
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Today's visits
          </h1>
          <p style={{ margin: '0.3rem 0 0', color: '#64748B', fontSize: '0.9375rem' }}>
            Live status of every visit scheduled today, act on late starts first.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-ghost btn-sm" disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorRetry message={error} onRetry={load} />}

      {loading && !data && <LoadingSkeleton rows={6} />}

      {data && (
        <>
          {/* Filter tabs with live counts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              const isLate = tab.key === 'late' && tab.count > 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    border: `1px solid ${active ? '#107480' : isLate ? '#FECACA' : '#E2E8F0'}`,
                    background: active ? '#107480' : isLate ? '#FEF2F2' : '#fff',
                    color: active ? '#fff' : isLate ? '#991B1B' : '#475569',
                  }}
                >
                  {tab.label}
                  <span style={{ marginLeft: '0.4rem', fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={filter === 'all' ? 'No visits scheduled today' : `No ${filter.replace('_', ' ')} visits`}
              body={
                filter === 'all'
                  ? 'Once visits are assigned for today, they will appear here as a live board.'
                  : 'Nothing in this bucket right now.'
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Client</th>
                    <th>Caregiver</th>
                    <th>Scheduled</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.assignmentId}>
                      <td><StatusBadge status={v.status} /></td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{v.clientName || '-'}</td>
                      <td>{v.caregiverName || '-'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(v.scheduledStartTime)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(v.clockInTime)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(v.clockOutTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: 0 }}>
            As of {fmtTime(data.generatedAt)} · auto-refreshes every minute
          </p>
        </>
      )}
    </div>
  );
}
