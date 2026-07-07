import React, { useEffect, useMemo, useState } from 'react';
import { getJson, postJson, ApiError } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface ExceptionResolutionResponse {
  agencyId: string;
  asOf: string;
  counts: {
    openExceptions: number;
    lateClockInOpen: number;
    missingLocationOpen: number;
    manualEntryOpen: number;
    telephonyFallbackOpen: number;
    vmurPending: number;
  };
  policy: {
    dhsResponseSlaHours: number;
  };
}

interface OpenExceptionListResponse {
  agencyId: string;
  asOf: string;
  rows: Array<{
    id: string;
    visitId: string;
    caregiverId: string;
    agencyId: string;
    exceptionType: string;
    reason: string;
    createdAt: string;
    visitClockInTime: string;
    visitStatus: string;
  }>;
  total: number;
  limit: number;
  offset: number;
  policy: { dhsResponseSlaHours: number };
}

interface AcknowledgeResponse {
  exception: { id: string };
  acknowledgedBy: string;
}

const EXCEPTION_TYPE_FILTERS: Array<{ label: string; value: '' | string }> = [
  { label: 'All types', value: '' },
  { label: 'Late clock-in', value: 'late-clock-in' },
  { label: 'Missing location', value: 'missing-location' },
  { label: 'Manual entry', value: 'manual-entry' },
  { label: 'Telephony fallback', value: 'telephony-fallback' },
];

function formatExceptionType(type: string): string {
  switch (type) {
    case 'late-clock-in':
      return 'Late clock-in';
    case 'missing-location':
      return 'Missing location';
    case 'manual-entry':
      return 'Manual entry';
    case 'telephony-fallback':
      return 'Telephony fallback';
    default:
      return type;
  }
}

function ageHoursFromClockIn(clockInIso: string, nowMs: number): number {
  const t = new Date(clockInIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (nowMs - t) / 3_600_000);
}

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-primary)',
  border: 'none',
  borderRadius: 10,
  color: 'var(--color-surface)',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 800,
  padding: '0.6rem 1rem',
};

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.25rem',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.7rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

export function ExceptionResolutionPage() {
  const [overview, setOverview] = useState<ExceptionResolutionResponse | null>(null);
  const [queue, setQueue] = useState<OpenExceptionListResponse | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [acking, setAcking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [ackInfo, setAckInfo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<ExceptionResolutionResponse>(
        '/api/compliance-engine/exceptions/overview',
      );
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async (filter: string) => {
    setQueueLoading(true);
    setAckError(null);
    try {
      const qs = new URLSearchParams();
      if (filter) qs.set('type', filter);
      qs.set('limit', '50');
      const data = await getJson<OpenExceptionListResponse>(
        `/api/compliance-engine/exceptions/list?${qs.toString()}`,
      );
      setQueue(data);
      // Drop selections that no longer exist in the refreshed page.
      setSelected((prev) => {
        const next = new Set<string>();
        const ids = new Set(data.rows.map((r) => r.id));
        for (const id of prev) if (ids.has(id)) next.add(id);
        return next;
      });
    } catch (err) {
      // 403 (coordinator/caregiver) → the route requires evv.read; the UI
      // already shows them the overview snapshot, so we just hide the queue.
      if (err instanceof ApiError && err.status === 403) {
        setQueue(null);
      } else {
        setAckError(err instanceof Error ? err.message : 'Failed to load queue');
      }
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadQueue('');
  }, []);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!queue) return;
    setSelected((prev) => {
      const allSelected = queue.rows.every((row) => prev.has(row.id));
      if (allSelected) return new Set<string>();
      return new Set(queue.rows.map((row) => row.id));
    });
  };

  const handleBulkAcknowledge = async () => {
    if (selected.size === 0) return;
    setAcking(true);
    setAckError(null);
    setAckInfo(null);
    let ok = 0;
    let skipped = 0;
    let failed = 0;
    for (const id of Array.from(selected)) {
      try {
        await postJson<AcknowledgeResponse>(
          `/api/compliance-engine/exceptions/${id}/acknowledge`,
          {},
        );
        ok += 1;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // Row was already acknowledged (race), counted as skipped, not failure.
          skipped += 1;
        } else if (err instanceof ApiError && err.status === 403) {
          // Caller lacks audit.read, abort the loop, surface single error.
          setAckError(
            'You do not have permission to acknowledge exceptions. Ask an admin to perform this action.',
          );
          break;
        } else {
          failed += 1;
        }
      }
    }
    setAcking(false);
    setAckInfo(
      `Acknowledged ${ok}` +
        (skipped ? `, skipped ${skipped} (already closed)` : '') +
        (failed ? `, ${failed} failed` : ''),
    );
    await loadQueue(typeFilter);
    await load();
  };

  const nowMs = useMemo(() => Date.now(), [queue?.asOf]);
  const slaHours = overview?.policy.dhsResponseSlaHours ?? queue?.policy.dhsResponseSlaHours ?? 48;

  const kpis: KpiTile[] = overview
    ? [
        {
          label: 'Open exceptions',
          value: overview.counts.openExceptions.toLocaleString(),
          tone: overview.counts.openExceptions > 0 ? 'warning' : 'neutral',
        },
        {
          label: 'Late clock-ins (open)',
          value: overview.counts.lateClockInOpen.toLocaleString(),
          tone: overview.counts.lateClockInOpen > 0 ? 'warning' : 'neutral',
          hint: '15-min grace',
        },
        {
          label: 'Missing location (open)',
          value: overview.counts.missingLocationOpen.toLocaleString(),
          tone: overview.counts.missingLocationOpen > 0 ? 'warning' : 'neutral',
        },
        {
          label: 'VMUR pending',
          value: overview.counts.vmurPending.toLocaleString(),
          tone: overview.counts.vmurPending > 0 ? 'accent' : 'neutral',
          hint: '7-day correction window',
        },
      ]
    : [
        { label: 'Open exceptions', value: '-', tone: 'warning' },
        { label: 'Late clock-ins (open)', value: '-', hint: '15-min grace' },
        { label: 'Missing location (open)', value: '-' },
        { label: 'VMUR pending', value: '-', tone: 'accent', hint: '7-day correction window' },
      ];

  const totalOpenByType =
    overview &&
    overview.counts.lateClockInOpen +
      overview.counts.missingLocationOpen +
      overview.counts.manualEntryOpen +
      overview.counts.telephonyFallbackOpen;

  return (
    <ComplianceModuleLayout
      title="Exception Resolution"
      tagline="Unified open-exception queue across PA EVV exception types (late-clock-in, missing-location, manual-entry, telephony-fallback) plus VMUR corrections within the 7-day window. Sized to the PA DHS 48-hour audit response SLA."
      status="live"
      kpis={kpis}
      dataSources={[
        'evv_exceptions (joined to evv_visits → caregivers for agency scope)',
        'visit_maintenance (VMUR), status=pending',
      ]}
      nextSteps={[
        'Row-level note capture (passes through to the audit event payload)',
        'SLA timer auto-escalation when an open exception ages past 48 hours',
        'Bulk filtering by caregiver / client (currently filters by exception type)',
      ]}
      related={[
        { label: 'Visit Review', to: '/admin/review' },
        { label: 'Corrections Queue', to: '/admin/corrections' },
        { label: 'Corrections Tracking', to: '/admin/corrections/tracking' },
      ]}
    >
      <div style={sectionCard}>
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
              Unified queue snapshot
            </h3>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.9rem',
                margin: '0.4rem 0 0',
              }}
            >
              Counts open EVV exceptions across all types plus pending VMUR for your agency.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            style={{ ...primaryButtonStyle, opacity: loading ? 0.55 : 1 }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 10,
            color: 'var(--color-danger)',
            fontSize: '0.9rem',
            fontWeight: 700,
            marginTop: '1rem',
            padding: '0.75rem 1rem',
          }}
        >
          {error}
        </div>
      ) : null}

      {overview ? (
        <div style={{ ...sectionCard, marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
            Breakdown by exception type
          </h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.8rem',
              margin: '0.35rem 0 0.75rem',
            }}
          >
            Snapshot as of <strong style={{ color: 'var(--color-text)' }}>{overview.asOf}</strong>.
            DHS response SLA: <strong>{overview.policy.dhsResponseSlaHours}h</strong>.
          </p>
          <ul
            style={{
              display: 'grid',
              gap: '0.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            <li>
              <span style={labelStyle}>Late clock-in</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {overview.counts.lateClockInOpen.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>Missing location</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {overview.counts.missingLocationOpen.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>Manual entry</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {overview.counts.manualEntryOpen.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>Telephony fallback</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {overview.counts.telephonyFallbackOpen.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>VMUR pending</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {overview.counts.vmurPending.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>Total open (EVV)</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {overview.counts.openExceptions.toLocaleString()}
              </p>
            </li>
          </ul>
          {totalOpenByType !== null &&
          totalOpenByType !== undefined &&
          totalOpenByType !== overview.counts.openExceptions ? (
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.78rem',
                margin: '0.75rem 0 0',
              }}
            >
              Open total includes other exception types not broken out here (count difference:{' '}
              {overview.counts.openExceptions - totalOpenByType}).
            </p>
          ) : null}
        </div>
      ) : !loading && !error ? (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No queue snapshot yet"
            body="Click Refresh to count the open EVV exceptions and pending VMUR records for your agency."
          />
        </div>
      ) : null}

      <div style={{ ...sectionCard, marginTop: '1rem' }}>
        <div
          style={{
            alignItems: 'flex-end',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h4 style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              Open exceptions queue
            </h4>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.85rem',
                margin: '0.25rem 0 0',
              }}
            >
              Oldest first. Each acknowledgement writes one <code>exception.approved</code> audit event
              against the {slaHours}-hour DHS SLA.
            </p>
          </div>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={labelStyle}>Filter</span>
              <select
                value={typeFilter}
                onChange={(event) => {
                  const next = event.target.value;
                  setTypeFilter(next);
                  void loadQueue(next);
                }}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text)',
                  fontSize: '0.9rem',
                  padding: '0.4rem 0.55rem',
                }}
              >
                {EXCEPTION_TYPE_FILTERS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadQueue(typeFilter)}
              disabled={queueLoading}
              style={{
                ...primaryButtonStyle,
                backgroundColor: 'var(--color-primary-dark)',
                opacity: queueLoading ? 0.55 : 1,
                padding: '0.5rem 0.85rem',
              }}
            >
              {queueLoading ? 'Loading…' : 'Refresh queue'}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkAcknowledge()}
              disabled={acking || selected.size === 0}
              style={{
                ...primaryButtonStyle,
                opacity: acking || selected.size === 0 ? 0.45 : 1,
                padding: '0.5rem 0.95rem',
              }}
            >
              {acking
                ? 'Acknowledging…'
                : `Acknowledge selected${selected.size ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>

        {ackError ? (
          <p
            role="alert"
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 8,
              color: 'var(--color-danger)',
              fontSize: '0.85rem',
              margin: '0.75rem 0 0',
              padding: '0.5rem 0.75rem',
            }}
          >
            {ackError}
          </p>
        ) : null}
        {ackInfo ? (
          <p
            role="status"
            style={{
              backgroundColor: 'var(--color-success-bg)',
              border: 'var(--color-success-border)',
              borderRadius: 8,
              color: 'var(--color-success)',
              fontSize: '0.85rem',
              margin: '0.75rem 0 0',
              padding: '0.5rem 0.75rem',
            }}
          >
            {ackInfo}
          </p>
        ) : null}

        {queue && queue.rows.length > 0 ? (
          <div style={{ marginTop: '0.85rem', overflowX: 'auto' }}>
            <table
              aria-label="Open EVV exceptions queue"
              style={{
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                minWidth: 700,
                width: '100%',
              }}
            >
              <caption
                style={{
                  /* Screen-reader-only caption: spelled out for assistive tech,
                     hidden from sighted users because the section heading above
                     already says "Open exceptions queue". */
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0,0,0,0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                Open EVV exceptions, oldest first. Use the checkbox column to select rows for
                bulk acknowledge.
              </caption>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left', width: 28 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={queue.rows.length > 0 && queue.rows.every((row) => selected.has(row.id))}
                      onChange={toggleAll}
                    />
                  </th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Type</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Reason</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Visit clock-in</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Age</th>
                </tr>
              </thead>
              <tbody>
                {queue.rows.map((row) => {
                  const ageH = ageHoursFromClockIn(row.visitClockInTime, nowMs);
                  const breached = ageH >= slaHours;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <td style={{ padding: '0.55rem 0.4rem' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select exception ${row.id}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem', fontWeight: 700 }}>
                        {formatExceptionType(row.exceptionType)}
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>{row.reason}</td>
                      <td style={{ padding: '0.55rem 0.4rem', whiteSpace: 'nowrap' }}>
                        {new Date(row.visitClockInTime).toLocaleString()}
                      </td>
                      <td
                        style={{
                          /* SLA-breached rows use the Deep Red brand accent, this is the
                             regulator-facing 48h DHS signal, not a transient error. */
                          color: breached ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          fontWeight: breached ? 800 : 600,
                          padding: '0.55rem 0.4rem',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ageH < 1 ? `${Math.round(ageH * 60)} min` : `${ageH.toFixed(1)} h`}
                        {breached ? ' · SLA' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.78rem',
                margin: '0.6rem 0 0',
              }}
            >
              Showing {queue.rows.length.toLocaleString()} of{' '}
              {queue.total.toLocaleString()} open exceptions
              {typeFilter ? ` (filtered to ${formatExceptionType(typeFilter)})` : ''}.
            </p>
          </div>
        ) : queue && queue.rows.length === 0 && !queueLoading ? (
          <ComplianceEmptyQueue
            title="Queue is clear"
            body={
              typeFilter
                ? `No open ${formatExceptionType(typeFilter)} exceptions right now.`
                : 'No open EVV exceptions for your agency. Nice work.'
            }
          />
        ) : queue === null && !queueLoading ? (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.85rem 0 0',
            }}
          >
            Queue list requires the <code>evv.read</code> capability. The snapshot above remains available.
          </p>
        ) : null}
      </div>
    </ComplianceModuleLayout>
  );
}
