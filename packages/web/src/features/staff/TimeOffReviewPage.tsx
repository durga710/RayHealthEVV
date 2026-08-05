import React, { useCallback, useEffect, useState } from 'react';
import { getJson, patchJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

/**
 * Time off review.
 *
 * Approving a request is a commitment, not a note: scheduling treats approved
 * leave as a hard conflict and will refuse to book over it. The page says so,
 * because a coordinator clicking approve should know it changes what the
 * assignment screen will let them do.
 */

type TimeOffStatus = 'requested' | 'approved' | 'denied' | 'cancelled';

interface TimeOffRequest {
  id: string;
  caregiverId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: TimeOffStatus;
  reviewNote: string | null;
}

const TABS: Array<{ key: TimeOffStatus; label: string }> = [
  { key: 'requested', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR: Record<TimeOffStatus, string> = {
  requested: 'var(--color-warning)',
  approved: 'var(--color-success)',
  denied: 'var(--color-danger-text)',
  cancelled: 'var(--color-text-subtle)',
};

function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : ymd;
}

function dayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function TimeOffReviewPage() {
  const [status, setStatus] = useState<TimeOffStatus>('requested');
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<{ requests: TimeOffRequest[] }>(`/api/availability/time-off?status=${status}`)
      .then((data) => setRequests(data?.requests ?? []))
      .catch((err: Error) => setError(err.message || 'Failed to load time off'))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const review = async (req: TimeOffRequest, next: 'approved' | 'denied') => {
    setBusy((prev) => ({ ...prev, [req.id]: true }));
    try {
      await patchJson(`/api/availability/time-off/${encodeURIComponent(req.id)}/review`, {
        status: next,
        ...(notes[req.id]?.trim() ? { note: notes[req.id].trim() } : {}),
      });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      setNotes((prev) => { const n = { ...prev }; delete n[req.id]; return n; });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update that request');
    } finally {
      setBusy((prev) => { const n = { ...prev }; delete n[req.id]; return n; });
    }
  };

  return (
    <div className="page">
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>Time Off</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Approving a request is a commitment: scheduling will refuse to book that caregiver on
          those days.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={status === tab.key ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => setStatus(tab.key)}
            aria-pressed={status === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorRetry message={error} onRetry={load} />
      ) : requests.length === 0 ? (
        <EmptyState
          title={status === 'requested' ? 'Nothing waiting for an answer' : 'Nothing here yet'}
          body={
            status === 'requested'
              ? 'When a caregiver requests time off in the mobile app it shows up here.'
              : 'Requests appear here once they reach this state.'
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '0.9rem 1rem',
                background: 'var(--color-surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {formatDate(req.startDate)}
                    {req.endDate !== req.startDate ? ` to ${formatDate(req.endDate)}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {dayCount(req.startDate, req.endDate)} day(s)
                  </div>
                </div>
                <span style={{
                  padding: '0.15em 0.6em', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                  background: `${STATUS_COLOR[req.status]}18`, color: STATUS_COLOR[req.status],
                }}>
                  {TABS.find((t) => t.key === req.status)?.label ?? req.status}
                </span>
              </div>

              {req.reason ? (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{req.reason}</div>
              ) : null}

              {req.reviewNote ? (
                <div style={{ marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Note: {req.reviewNote}
                </div>
              ) : null}

              {req.status === 'requested' ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    value={notes[req.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    placeholder="Note (optional, shown to the caregiver)"
                    className="input-field"
                    style={{ fontSize: '0.8125rem', padding: '0.3rem 0.6rem', flex: '1 1 240px', minWidth: 0 }}
                    maxLength={500}
                  />
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={busy[req.id] ?? false}
                    onClick={() => void review(req, 'approved')}
                  >
                    {busy[req.id] ? 'Saving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy[req.id] ?? false}
                    onClick={() => void review(req, 'denied')}
                  >
                    Deny
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TimeOffReviewPage;
