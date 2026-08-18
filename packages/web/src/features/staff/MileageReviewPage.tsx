import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getJson, patchJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';
import { tint } from '../../lib/color.js';

/**
 * Mileage review.
 *
 * The agency side of caregiver mileage: approve or reject what caregivers
 * logged. Defaults to the pending queue, because that is the only list with
 * work in it; approved and rejected are there for looking something up, not
 * for daily use.
 */

type MileageStatus = 'submitted' | 'approved' | 'rejected';

interface MileageEntry {
  id: string;
  caregiverId: string;
  tripDate: string;
  milesHundredths: number;
  purpose: string | null;
  status: MileageStatus;
  reviewNote: string | null;
  createdAt: string | null;
}

const STATUS_TABS: Array<{ key: MileageStatus; label: string }> = [
  { key: 'submitted', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Not approved' },
];

const STATUS_COLOR: Record<MileageStatus, string> = {
  submitted: 'var(--color-warning)',
  approved: 'var(--color-success)',
  rejected: 'var(--color-danger-text)',
};

function formatMiles(hundredths: number): string {
  return `${(hundredths / 100).toFixed(2)} mi`;
}

function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : ymd;
}

export function MileageReviewPage() {
  const [status, setStatus] = useState<MileageStatus>('submitted');
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<{ entries: MileageEntry[] }>(`/api/mileage?status=${status}`)
      .then((data) => setEntries(data?.entries ?? []))
      .catch((err: Error) => setError(err.message || 'Failed to load mileage'))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const totalHundredths = useMemo(
    () => entries.reduce((sum, e) => sum + e.milesHundredths, 0),
    [entries],
  );

  const review = async (entry: MileageEntry, next: 'approved' | 'rejected') => {
    setBusy((prev) => ({ ...prev, [entry.id]: true }));
    try {
      await patchJson(`/api/mileage/${encodeURIComponent(entry.id)}/review`, {
        status: next,
        ...(notes[entry.id]?.trim() ? { note: notes[entry.id].trim() } : {}),
      });
      // Drop the row from the current tab rather than refetching: it no
      // longer belongs to the list being viewed.
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setNotes((prev) => { const n = { ...prev }; delete n[entry.id]; return n; });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update that trip');
    } finally {
      setBusy((prev) => { const n = { ...prev }; delete n[entry.id]; return n; });
    }
  };

  return (
    <div className="page">
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0 }}>Mileage</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
          Driving logged by caregivers between clients. Approved trips are what your payroll or
          reimbursement run should pay.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {STATUS_TABS.map((tab) => (
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
      ) : entries.length === 0 ? (
        <EmptyState
          title={status === 'submitted' ? 'Nothing waiting for review' : 'Nothing here yet'}
          body={
            status === 'submitted'
              ? 'When a caregiver logs a trip in the mobile app it shows up here.'
              : 'Trips appear here once they have been reviewed.'
          }
        />
      ) : (
        <>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {entries.length} {entries.length === 1 ? 'trip' : 'trips'} · {formatMiles(totalHundredths)} total
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '0.9rem 1rem',
                  background: 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{formatMiles(entry.milesHundredths)}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(entry.tripDate)}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.15em 0.6em', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                    background: tint(STATUS_COLOR[entry.status], 9), color: STATUS_COLOR[entry.status],
                  }}>
                    {STATUS_TABS.find((t) => t.key === entry.status)?.label ?? entry.status}
                  </span>
                </div>

                {entry.purpose ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{entry.purpose}</div>
                ) : null}

                {entry.reviewNote ? (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Note: {entry.reviewNote}
                  </div>
                ) : null}

                {entry.status === 'submitted' ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      value={notes[entry.id] ?? ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                      placeholder="Note (optional, shown to the caregiver if not approved)"
                      className="input-field"
                      style={{ fontSize: '0.8125rem', padding: '0.3rem 0.6rem', flex: '1 1 240px', minWidth: 0 }}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busy[entry.id] ?? false}
                      onClick={() => void review(entry, 'approved')}
                    >
                      {busy[entry.id] ? 'Saving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={busy[entry.id] ?? false}
                      onClick={() => void review(entry, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MileageReviewPage;
