import React, { useEffect, useMemo, useState } from 'react';
import { getJson } from '../../lib/api-client.js';

/**
 * Admin-only audit events timeline.
 *
 * Backed by `GET /api/admin/audit-events` (capability `audit.read`,
 * admin-only). Surfaces the full filterable, paginated audit log so an
 * admin / compliance officer can investigate access patterns, failed
 * logins, PHI reads, permission denials, and CSRF failures across the
 * agency.
 *
 * Styling mirrors AuditRetentionPage for visual consistency.
 */

type Outcome = 'success' | 'failure' | 'denied';

interface AuditEventRow {
  id: string;
  agencyId: string;
  actorId: string;
  actorType: 'user' | 'service' | 'system';
  eventType: string;
  entityType: string;
  entityId: string;
  outcome: Outcome;
  correlationId?: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
  createdAt?: string;
}

interface ListResponse {
  rows: AuditEventRow[];
  total: number;
  limit: number;
  offset: number;
}

// Subset that powers the filter dropdown. Keep aligned with
// `auditEventTypes` in packages/core/src/domain/audit.ts — listed here as a
// finite enum rather than fetched dynamically so the filter remains stable.
const EVENT_TYPE_OPTIONS = [
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'session.created',
  'session.revoked',
  'csrf.failure',
  'phi.read',
  'phi.create',
  'phi.update',
  'phi.delete',
  'phi.export',
  'request.write',
  'permission.denied',
  'visit.created',
  'visit.clock-out',
  'visit.approved',
  'visit.flagged',
  'credential.created',
  'credential.expired',
  'credential.renewed',
  'caregiver.created',
  'caregiver.status-changed',
  'assignment.created',
  'assignment.cancelled',
  'exception.filed',
  'exception.approved',
  'invite.created',
  'invite.accepted'
] as const;

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid #E2E8F0'
};

const statLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.06em'
};

const input: React.CSSProperties = {
  padding: '0.5rem 0.7rem',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  fontSize: '0.85rem',
  backgroundColor: 'white',
  fontFamily: 'inherit',
  color: '#0F172A',
};

function outcomePillStyle(outcome: Outcome): React.CSSProperties {
  const palette: Record<Outcome, { bg: string; fg: string; border: string }> = {
    success: { bg: '#f0fdf4', fg: '#15803d', border: '#86efac' },
    failure: { bg: '#fef2f2', fg: '#991b1b', border: '#fca5a5' },
    denied: { bg: '#fffbeb', fg: '#92400e', border: '#fcd34d' }
  };
  const p = palette[outcome] ?? palette.success;
  return {
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
    backgroundColor: p.bg,
    color: p.fg,
    border: `1px solid ${p.border}`,
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };
}

function eventTypeBadgeStyle(eventType: string): React.CSSProperties {
  // Group-coded: auth/session/csrf = blue; phi = purple; permission = red;
  // invite = teal; everything else = slate. Visual scan for "what kind".
  let bg = '#f1f5f9';
  let fg = '#334155';
  if (eventType.startsWith('auth.') || eventType.startsWith('session.') || eventType === 'csrf.failure') {
    bg = '#eff6ff';
    fg = '#1d4ed8';
  } else if (eventType.startsWith('phi.')) {
    bg = '#faf5ff';
    fg = '#6b21a8';
  } else if (eventType === 'permission.denied') {
    bg = '#fef2f2';
    fg = '#991b1b';
  } else if (eventType.startsWith('invite.')) {
    bg = '#ecfeff';
    fg = '#155e75';
  }
  return {
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: '6px',
    fontSize: '0.74rem',
    fontWeight: 600,
    backgroundColor: bg,
    color: fg,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
  };
}

function toIsoOrUndefined(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function buildQueryString(filters: {
  eventType: string;
  actorId: string;
  outcome: string;
  from: string;
  to: string;
  limit: number;
  offset: number;
}): string {
  const params = new URLSearchParams();
  if (filters.eventType) params.set('eventType', filters.eventType);
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.outcome) params.set('outcome', filters.outcome);
  const fromIso = toIsoOrUndefined(filters.from);
  if (fromIso) params.set('from', fromIso);
  const toIso = toIsoOrUndefined(filters.to);
  if (toIso) params.set('to', toIso);
  params.set('limit', String(filters.limit));
  params.set('offset', String(filters.offset));
  return params.toString();
}

export function AuditEventsPage() {
  // Form (editable) vs applied (committed on submit) so typing in the
  // actor-id field doesn't refire the network on every keystroke.
  const [formEventType, setFormEventType] = useState('');
  const [formActorId, setFormActorId] = useState('');
  const [formOutcome, setFormOutcome] = useState('');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formLimit, setFormLimit] = useState<number>(50);

  const [appliedEventType, setAppliedEventType] = useState('');
  const [appliedActorId, setAppliedActorId] = useState('');
  const [appliedOutcome, setAppliedOutcome] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedLimit, setAppliedLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryString = useMemo(
    () =>
      buildQueryString({
        eventType: appliedEventType,
        actorId: appliedActorId,
        outcome: appliedOutcome,
        from: appliedFrom,
        to: appliedTo,
        limit: appliedLimit,
        offset
      }),
    [appliedEventType, appliedActorId, appliedOutcome, appliedFrom, appliedTo, appliedLimit, offset]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    getJson<ListResponse>(`/api/admin/audit-events?${queryString}`)
      .then((res) => setData(res))
      .catch((err: Error) => setError(err.message || 'Failed to load audit events'))
      .finally(() => setLoading(false));
  }, [queryString]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedEventType(formEventType);
    setAppliedActorId(formActorId);
    setAppliedOutcome(formOutcome);
    setAppliedFrom(formFrom);
    setAppliedTo(formTo);
    setAppliedLimit(formLimit);
    setOffset(0);
    setExpandedId(null);
  };

  const resetFilters = () => {
    setFormEventType('');
    setFormActorId('');
    setFormOutcome('');
    setFormFrom('');
    setFormTo('');
    setFormLimit(50);
    setAppliedEventType('');
    setAppliedActorId('');
    setAppliedOutcome('');
    setAppliedFrom('');
    setAppliedTo('');
    setAppliedLimit(50);
    setOffset(0);
    setExpandedId(null);
  };

  const total = data?.total ?? 0;
  const limit = data?.limit ?? appliedLimit;
  const currentOffset = data?.offset ?? offset;
  const pageStart = total === 0 ? 0 : currentOffset + 1;
  const pageEnd = Math.min(currentOffset + limit, total);
  const canPrev = currentOffset > 0;
  const canNext = currentOffset + limit < total;

  return (
    <div>
      {/* Dark gradient hero banner */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '14px',
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          border: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              fontSize: '1.75rem',
              lineHeight: 1,
              marginTop: '0.1rem',
              flexShrink: 0
            }}
          >
            🔒
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#F1F5F9',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}
            >
              Audit Events
            </h1>
            <p
              style={{
                margin: '0.4rem 0 0',
                color: '#64748B',
                maxWidth: '620px',
                fontSize: '0.9rem',
                lineHeight: 1.5
              }}
            >
              Filterable timeline of every audit event for this agency &mdash; authentication, PHI access,
              permission denials, CSRF failures, and lifecycle events. Backed by the same append-only
              store as the retention dashboard.
            </p>
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(124, 58, 237,0.2)',
            color: '#C7D2FE',
            borderRadius: '6px',
            padding: '0.3rem 0.75rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            alignSelf: 'flex-start'
          }}
        >
          Append-only &middot; HIPAA
        </div>
      </header>

      {/* Filter form card */}
      <form
        onSubmit={applyFilters}
        style={{
          ...card,
          marginBottom: '1rem',
          borderTop: '3px solid #7c3aed'
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '0.85rem'
          }}
        >
          Filters
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem'
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={statLabel}>Event type</span>
            <select
              style={input}
              value={formEventType}
              onChange={(e) => setFormEventType(e.target.value)}
            >
              <option value="">All</option>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={statLabel}>Actor ID (uuid)</span>
            <input
              style={input}
              type="text"
              placeholder="e.g. 00000000-..."
              value={formActorId}
              onChange={(e) => setFormActorId(e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={statLabel}>Outcome</span>
            <select
              style={input}
              value={formOutcome}
              onChange={(e) => setFormOutcome(e.target.value)}
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={statLabel}>From</span>
            <input
              style={input}
              type="datetime-local"
              value={formFrom}
              onChange={(e) => setFormFrom(e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={statLabel}>To</span>
            <input
              style={input}
              type="datetime-local"
              value={formTo}
              onChange={(e) => setFormTo(e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={statLabel}>Page size</span>
            <select
              style={input}
              value={formLimit}
              onChange={(e) => setFormLimit(Number(e.target.value))}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn-primary btn-sm">
            Apply
          </button>
          <button type="button" onClick={resetFilters} className="btn-secondary btn-sm">
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div style={{ ...card, textAlign: 'center', color: '#64748b' }}>Loading...</div>
      )}

      {!loading && error && (
        <div role="alert" style={{ ...card, backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && data.rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#64748b' }}>
          No audit events match your filters.
        </div>
      )}

      {!loading && !error && data && data.rows.length > 0 && (
        <div style={card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
              fontSize: '0.85rem',
              color: '#475569'
            }}
          >
            <span>
              Showing <strong>{pageStart.toLocaleString()}</strong>-
              <strong>{pageEnd.toLocaleString()}</strong> of{' '}
              <strong>{total.toLocaleString()}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!canPrev}
                onClick={() => setOffset(Math.max(0, currentOffset - limit))}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!canNext}
                onClick={() => setOffset(currentOffset + limit)}
              >
                Next
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.6rem' }}>Occurred</th>
                <th style={{ padding: '0.6rem' }}>Event</th>
                <th style={{ padding: '0.6rem' }}>Actor</th>
                <th style={{ padding: '0.6rem' }}>Entity</th>
                <th style={{ padding: '0.6rem' }}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const isOpen = expandedId === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(isOpen ? null : row.id)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        backgroundColor: isOpen ? '#f8fafc' : 'white'
                      }}
                    >
                      <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>
                        {row.occurredAt ? new Date(row.occurredAt).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <span style={eventTypeBadgeStyle(row.eventType)}>{row.eventType}</span>
                      </td>
                      <td
                        style={{
                          padding: '0.6rem',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontSize: '0.78rem'
                        }}
                        title={row.actorId}
                      >
                        {row.actorId ? `${row.actorId.slice(0, 8)}...` : '-'}
                      </td>
                      <td style={{ padding: '0.6rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#475569' }}>{row.entityType}</span>{' '}
                        <span
                          style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            color: '#94a3b8'
                          }}
                          title={row.entityId}
                        >
                          {row.entityId ? row.entityId.slice(0, 8) : '-'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <span style={outcomePillStyle(row.outcome)}>{row.outcome}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <td colSpan={5} style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                              <strong>Event ID:</strong>{' '}
                              <code>{row.id}</code>
                              {row.correlationId && (
                                <>
                                  {'   '}
                                  <strong>Correlation:</strong>{' '}
                                  <code>{row.correlationId}</code>
                                </>
                              )}
                              {'   '}
                              <strong>Actor type:</strong> {row.actorType}
                            </div>
                            <div>
                              <div style={statLabel}>Payload</div>
                              <pre
                                style={{
                                  marginTop: '0.4rem',
                                  padding: '0.75rem',
                                  backgroundColor: '#0f172a',
                                  color: '#e2e8f0',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  overflowX: 'auto',
                                  maxHeight: '320px'
                                }}
                              >
                                {JSON.stringify(row.payload ?? {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
