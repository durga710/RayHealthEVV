import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';
import { tint } from '../../lib/color.js';

/**
 * Admin-only HIPAA audit-retention evidence dashboard.
 *
 * Backed by `GET /api/admin/audit-retention/status` (capability
 * `audit.read`, admin-only). Surfaces the data an HHS auditor or an
 * agency compliance officer needs to demonstrate that audit logs are
 * being retained per 45 CFR §164.530(j), without exposing PHI.
 */

interface RetentionStatus {
  totalRows: number;
  oldestOccurredAt: string | null;
  eventsLast30Days: number;
  eventsApproachingSixYearLimit: number;
  retentionFloorYears: number;
  immutabilityTrigger: string;
}

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid var(--color-border)'
};

const stat: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem'
};

const statValue: React.CSSProperties = {
  fontSize: '1.875rem',
  fontWeight: 700,
  color: 'var(--color-text)',
  lineHeight: 1,
  letterSpacing: '-0.02em'
};

const statLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em'
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function AuditRetentionPage() {
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getJson<RetentionStatus>('/api/admin/audit-retention/status')
      .then((data) => {
        setStatus(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load retention status');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Dark gradient hero banner */}
      <header
        style={{
          background: 'linear-gradient(135deg, var(--color-text) 0%, var(--color-slate-800) 100%)',
          borderRadius: '14px',
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          border: '1px solid var(--color-slate-800)',
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
              lineHeight: 1,
              marginTop: '0.1rem',
              flexShrink: 0,
              color: 'var(--color-primary)'
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect width="20" height="5" x="2" y="3" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-surface-soft)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}
            >
              Audit Log Retention
            </h1>
            <p
              style={{
                margin: '0.4rem 0 0',
                color: 'var(--color-text-muted)',
                maxWidth: '620px',
                fontSize: '0.9rem',
                lineHeight: 1.5
              }}
            >
              HIPAA evidence dashboard &mdash; 45 CFR §164.530(j) requires 6-year retention of audit logs.
              This page reports the data of record without exposing PHI.
            </p>
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: tint('var(--color-primary)', 20),
            color: 'var(--color-primary-light)',
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

      {loading && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      )}

      {!loading && error && (
        <div role="alert" style={{ ...card, backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' }}>
          {error}
        </div>
      )}

      {!loading && !error && status && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div
            style={{
              ...card,
              backgroundColor:
                status.eventsApproachingSixYearLimit > 0 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
              borderColor:
                status.eventsApproachingSixYearLimit > 0 ? 'var(--color-warning-border)' : 'var(--color-success-border)'
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: status.eventsApproachingSixYearLimit > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
              Compliance status
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '0.4rem', color: status.eventsApproachingSixYearLimit > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
              {status.eventsApproachingSixYearLimit > 0 ? (
                <>
                  {formatNumber(status.eventsApproachingSixYearLimit)} event(s) older than 5y 9m , 
                  schedule cold-storage extraction within 90 days to stay above the{' '}
                  {status.retentionFloorYears}-year statutory floor.
                </>
              ) : (
                <>
                  All retained events are within the {status.retentionFloorYears}-year floor.
                  No archival action required.
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ ...card, borderTop: '3px solid var(--color-primary)' }}>
              <div style={stat}>
                <div style={statLabel}>Total events</div>
                <div style={statValue}>{formatNumber(status.totalRows)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>retained for this agency</div>
              </div>
            </div>
            <div style={{ ...card, borderTop: '3px solid var(--color-primary)' }}>
              <div style={stat}>
                <div style={statLabel}>Last 30 days</div>
                <div style={statValue}>{formatNumber(status.eventsLast30Days)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>recent activity</div>
              </div>
            </div>
            <div style={{ ...card, borderTop: '3px solid var(--color-primary-dark)' }}>
              <div style={stat}>
                <div style={statLabel}>Oldest event</div>
                <div style={statValue}>
                  {status.oldestOccurredAt ? `${daysSince(status.oldestOccurredAt)}d` : '-'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                  {status.oldestOccurredAt
                    ? new Date(status.oldestOccurredAt).toISOString().slice(0, 10)
                    : 'no events yet'}
                </div>
              </div>
            </div>
            <div
              style={{
                ...card,
                borderTop: `3px solid ${status.eventsApproachingSixYearLimit > 0 ? 'var(--color-warning)' : 'var(--color-success)'}`
              }}
            >
              <div style={stat}>
                <div style={statLabel}>Approaching 6y limit</div>
                <div
                  style={{
                    ...statValue,
                    color: status.eventsApproachingSixYearLimit > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)'
                  }}
                >
                  {formatNumber(status.eventsApproachingSixYearLimit)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>older than 5y 9m</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, borderTop: '3px solid var(--color-text-secondary)' }}>
            <div style={statLabel}>Append-only enforcement</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Postgres trigger{' '}
              <code style={{ backgroundColor: 'var(--color-surface-soft)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                {status.immutabilityTrigger}
              </code>{' '}
              blocks UPDATE and DELETE on <code>audit_events</code> at the database
              layer. Application code physically cannot mutate or remove a logged event.
            </div>
          </div>

          <div style={{ ...card, backgroundColor: 'var(--color-bg)', borderTop: '3px solid var(--color-border)' }}>
            <div style={statLabel}>Statutory reference</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              45 CFR §164.530(j), <em>Documentation</em>. Covered entities must retain
              required documentation, including audit logs of access to ePHI, for{' '}
              <strong>{status.retentionFloorYears} years</strong> from the date of its
              creation or the date when it last was in effect, whichever is later.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
