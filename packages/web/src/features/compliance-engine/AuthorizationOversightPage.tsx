import React, { useEffect, useState } from 'react';
import { getJson, ApiError } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface AuthorizationOversightResponse {
  agencyId: string;
  asOf: string;
  counts: {
    activeAuthorizations: number;
    expiringIn14d: number;
    expiringIn30d: number;
    recentlyExpired: number;
  };
  policy: {
    chcQuarterlyReviewDays: number;
  };
}

type AuthorizationListFilter =
  | 'active'
  | 'expiring-14d'
  | 'expiring-30d'
  | 'expiring-90d'
  | 'recently-expired';

interface AuthorizationListRow {
  id: string;
  clientId: string;
  clientName: string;
  payerId: string;
  serviceCode: string;
  startDate: string;
  endDate: string;
  unitsAuthorized: number;
  unitsUsed: number;
  unitsRemaining: number;
  daysToExpiry: number;
  urgency: 'expired' | 'critical' | 'warning' | 'info' | 'ok';
}

interface AuthorizationListResponse {
  agencyId: string;
  rows: AuthorizationListRow[];
  total: number;
  limit: number;
  offset: number;
  asOf: string;
  policy: { chcQuarterlyReviewDays: number };
}

const FILTER_OPTIONS: Array<{ label: string; value: AuthorizationListFilter }> = [
  { label: 'Active', value: 'active' },
  { label: 'Expiring 14d', value: 'expiring-14d' },
  { label: 'Expiring 30d', value: 'expiring-30d' },
  { label: 'Expiring 90d (CHC review)', value: 'expiring-90d' },
  { label: 'Recently expired', value: 'recently-expired' },
];

/**
 * Urgency palette. Uses the Deep Red brand accent for the two most-urgent
 * tiers (expired + critical ≤14d) so the regulator-facing signal is part of
 * the brand identity. Warning + info + ok degrade through the semantic
 * palette so they read distinctly from each other under colorblind viewing.
 */
const URGENCY_STYLE: Record<AuthorizationListRow['urgency'], { bg: string; fg: string; label: string }> = {
  expired:  { bg: 'var(--color-accent-bg)',  fg: 'var(--color-accent-dark)',   label: 'Expired' },
  critical: { bg: 'var(--color-accent-bg)',  fg: 'var(--color-accent)',        label: '≤14d' },
  warning:  { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)',       label: '≤30d' },
  info:     { bg: 'var(--color-primary-bg)', fg: 'var(--color-primary-dark)',  label: '≤90d' },
  ok:       { bg: '#F1F5F9',                  fg: 'var(--color-text-secondary)', label: 'OK' },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text)',
  fontSize: '0.95rem',
  padding: '0.55rem 0.75rem',
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-primary)',
  border: 'none',
  borderRadius: 10,
  color: 'var(--color-surface)',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 800,
  padding: '0.65rem 1.1rem',
};

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.25rem',
};

export function AuthorizationOversightPage() {
  const [asOf, setAsOf] = useState<string>(todayIso());
  const [overview, setOverview] = useState<AuthorizationOversightResponse | null>(null);
  const [list, setList] = useState<AuthorizationListResponse | null>(null);
  const [filter, setFilter] = useState<AuthorizationListFilter>('expiring-30d');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const load = async (effectiveAsOf: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<AuthorizationOversightResponse>(
        `/api/compliance-engine/authorizations/overview?asOf=${encodeURIComponent(effectiveAsOf)}`,
      );
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  const loadList = async (effectiveAsOf: string, effectiveFilter: AuthorizationListFilter) => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        asOf: effectiveAsOf,
        filter: effectiveFilter,
        limit: '50',
      });
      const data = await getJson<AuthorizationListResponse>(
        `/api/compliance-engine/authorizations/list?${params.toString()}`,
      );
      setList(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setList(null);
      } else {
        setListError(err instanceof Error ? err.message : 'Failed to load list');
      }
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    const today = todayIso();
    void load(today);
    void loadList(today, filter);
  }, []);

  const handleRefresh = (event: React.FormEvent) => {
    event.preventDefault();
    void load(asOf);
    void loadList(asOf, filter);
  };

  const handleFilterChange = (next: AuthorizationListFilter) => {
    setFilter(next);
    void loadList(asOf, next);
  };

  const kpis: KpiTile[] = overview
    ? [
        {
          label: 'Active authorizations',
          value: overview.counts.activeAuthorizations.toLocaleString(),
        },
        {
          label: 'Expiring 14d',
          value: overview.counts.expiringIn14d.toLocaleString(),
          tone: 'warning',
        },
        {
          label: 'Expiring 30d',
          value: overview.counts.expiringIn30d.toLocaleString(),
        },
        {
          label: 'Recently expired',
          value: overview.counts.recentlyExpired.toLocaleString(),
          tone: 'warning',
          hint: 'last 14 days',
        },
      ]
    : [
        { label: 'Active authorizations', value: ', ' },
        { label: 'Expiring 14d', value: ', ', tone: 'warning' },
        { label: 'Expiring 30d', value: ', ' },
        { label: 'Recently expired', value: ', ', tone: 'warning' },
      ];

  return (
    <ComplianceModuleLayout
      title="Authorization Oversight"
      tagline="Compliance lens on service authorizations: live unit balance (EVV-consumed vs authorized), expirations, and the 90-day CHC quarterly review cycle per 55 Pa. Code Chapter 6000. Distinct from the record-level CRUD page."
      status="live"
      kpis={kpis}
      dataSources={[
        'authorizations table (joined to clients for agency scope)',
        'evv_visits → assignments → visit_templates → clients (live unit consumption)',
        'CHC MCO references: AmeriHealth Caritas NE, PA Health & Wellness, UPMC CHC',
      ]}
      nextSteps={[
        '14-day + 30-day expiry alerts emailed to coordinators',
        'Overage prevention guard at assignment-create time',
        'Per-MCO breakdown column (requires chc_mco_id migration)',
      ]}
      related={[
        { label: 'Authorizations (CRUD)', to: '/admin/authorizations' },
        { label: 'Assignments', to: '/admin/assignments' },
        { label: 'Medicaid Workflow', to: '/admin/compliance-engine/medicaid' },
      ]}
    >
      <div style={sectionCard}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          Refresh oversight
        </h3>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            margin: '0.5rem 0 1rem',
          }}
        >
          Pick the &quot;as of&quot; date and refresh to recount active, expiring, and recently-expired
          authorizations.
        </p>
        <form
          onSubmit={handleRefresh}
          style={{
            alignItems: 'flex-end',
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>As of</span>
            <input
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={loading || !asOf}
            style={{ ...primaryButtonStyle, opacity: loading || !asOf ? 0.55 : 1 }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </form>
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
            Snapshot as of {overview.asOf}
          </h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.35rem 0 0.75rem',
            }}
          >
            CHC quarterly review cycle: <strong>{overview.policy.chcQuarterlyReviewDays} days</strong>{' '}
            (per 55 Pa. Code Chapter 6000)
          </p>
          {overview.counts.expiringIn14d === 0 && overview.counts.recentlyExpired === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
              No authorizations need attention in the next 14 days or the last 14.
            </p>
          ) : (
            <ul style={{ color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0, paddingLeft: '1.25rem' }}>
              {overview.counts.expiringIn14d > 0 ? (
                <li>
                  <strong>{overview.counts.expiringIn14d}</strong> authorization
                  {overview.counts.expiringIn14d === 1 ? '' : 's'} expiring in the next 14 days.
                </li>
              ) : null}
              {overview.counts.expiringIn30d > overview.counts.expiringIn14d ? (
                <li>
                  <strong>{overview.counts.expiringIn30d - overview.counts.expiringIn14d}</strong> more
                  expiring in days 15&ndash;30.
                </li>
              ) : null}
              {overview.counts.recentlyExpired > 0 ? (
                <li>
                  <strong>{overview.counts.recentlyExpired}</strong> recently expired (last 14 days).
                  Review for renewal or backdating.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : !loading && !error ? (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No oversight loaded"
            body="Pick a date and click Refresh to load the authorization oversight snapshot."
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
              Authorization detail
            </h4>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.85rem',
                margin: '0.25rem 0 0',
              }}
            >
              Sorted by earliest end date. <strong>Units used</strong> = sum of EVV-verified
              hours (clock_out − clock_in) for visits whose date fell inside the authorization
              window, 1 unit ≈ 1 hour for PA personal-care/home-health codes.
            </p>
          </div>
          <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleFilterChange(opt.value)}
                  style={{
                    backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 999,
                    color: active ? 'var(--color-surface)' : 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    padding: '0.4rem 0.85rem',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {listError ? (
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
            {listError}
          </p>
        ) : null}

        {list && list.rows.length > 0 ? (
          <div style={{ marginTop: '0.85rem', overflowX: 'auto' }}>
            <table
              aria-label="Authorizations detail list with live unit balance"
              style={{
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                minWidth: 760,
                width: '100%',
              }}
            >
              <caption
                style={{
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
                Authorizations sorted by earliest end date. Units used is computed from
                EVV-verified visit hours; 1 unit equals 1 hour for PA personal-care S5125 and
                home-health T1019.
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
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Client</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Payer</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'left' }}>Service</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Units used / auth</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Remaining</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>End</th>
                  <th scope="col" style={{ padding: '0.5rem 0.4rem', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => {
                  const pct =
                    row.unitsAuthorized > 0
                      ? Math.min(100, (row.unitsUsed / row.unitsAuthorized) * 100)
                      : 0;
                  const tone = URGENCY_STYLE[row.urgency];
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <td style={{ fontWeight: 700, padding: '0.55rem 0.4rem' }}>
                        {row.clientName || row.clientId}
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>{row.payerId}</td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>{row.serviceCode}</td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>
                        <div style={{ alignItems: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <div
                            aria-hidden
                            style={{
                              backgroundColor: 'var(--color-border)',
                              borderRadius: 999,
                              height: 6,
                              overflow: 'hidden',
                              width: 80,
                            }}
                          >
                            <div
                              style={{
                                backgroundColor:
                                  pct >= 90
                                    ? 'var(--color-accent)'       /* ≥90% used, deep red regulatory signal */
                                    : pct >= 70
                                    ? 'var(--color-warning)'      /* ≥70% used, amber attention */
                                    : 'var(--color-primary)',     /* normal, purple brand */
                                height: '100%',
                                width: `${pct}%`,
                              }}
                            />
                          </div>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {row.unitsUsed.toFixed(1)} / {row.unitsAuthorized.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>
                        {row.unitsRemaining.toFixed(1)}
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {row.endDate}
                        <br />
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                          {row.daysToExpiry >= 0
                            ? `${row.daysToExpiry}d to go`
                            : `${Math.abs(row.daysToExpiry)}d ago`}
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>
                        <span
                          style={{
                            backgroundColor: tone.bg,
                            borderRadius: 999,
                            color: tone.fg,
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            padding: '0.2rem 0.55rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          {tone.label}
                        </span>
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
              Showing {list.rows.length.toLocaleString()} of {list.total.toLocaleString()}{' '}
              authorizations in this lens (as of {list.asOf}).
            </p>
          </div>
        ) : list && list.rows.length === 0 && !listLoading ? (
          <ComplianceEmptyQueue
            title="Nothing in this lens"
            body={`No authorizations matched ${FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter} for as-of ${asOf}.`}
          />
        ) : list === null && !listLoading ? (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.85rem 0 0',
            }}
          >
            Detail list requires the <code>client.read</code> capability. Snapshot counts above are still available.
          </p>
        ) : null}
      </div>
    </ComplianceModuleLayout>
  );
}
