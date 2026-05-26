import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface MedicaidWorkflowResponse {
  agencyId: string;
  asOf: string;
  counts: {
    activeMaCases: number;
    distinctPayers: number;
    distinctServiceCodes: number;
    newAuthsLast30d: number;
  };
  policy: {
    chcQuarterlyReviewDays: number;
    chcMcos: string[];
  };
}

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
  padding: '0.6rem 1rem',
};

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.25rem',
};

export function MedicaidWorkflowPage() {
  const [asOf, setAsOf] = useState<string>(todayIso());
  const [snapshot, setSnapshot] = useState<MedicaidWorkflowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (effectiveAsOf: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<MedicaidWorkflowResponse>(
        `/api/compliance-engine/medicaid/overview?asOf=${encodeURIComponent(effectiveAsOf)}`,
      );
      setSnapshot(data);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(todayIso());
  }, []);

  const handleRefresh = (event: React.FormEvent) => {
    event.preventDefault();
    void load(asOf);
  };

  const kpis: KpiTile[] = snapshot
    ? [
        { label: 'Active MA cases', value: snapshot.counts.activeMaCases.toLocaleString() },
        {
          label: 'Distinct payers',
          value: snapshot.counts.distinctPayers.toLocaleString(),
          hint: 'across active auths',
        },
        {
          label: 'Service codes in use',
          value: snapshot.counts.distinctServiceCodes.toLocaleString(),
          hint: 'service mix',
        },
        {
          label: 'New auths (30d)',
          value: snapshot.counts.newAuthsLast30d.toLocaleString(),
          tone: 'accent',
        },
      ]
    : [
        { label: 'Active MA cases', value: '—' },
        { label: 'Distinct payers', value: '—', hint: 'across active auths' },
        { label: 'Service codes in use', value: '—', hint: 'service mix' },
        { label: 'New auths (30d)', value: '—', tone: 'accent' },
      ];

  return (
    <ComplianceModuleLayout
      title="Medicaid Workflow"
      tagline="CHC eligibility, prior authorizations, and PA Medicaid service mix readiness — synced to PROMISe MMIS (planned), with the 90-day quarterly review cycle required by 55 Pa. Code Chapter 6000."
      status="live"
      kpis={kpis}
      dataSources={[
        'authorizations (joined to clients for agency scope)',
        'CHC MCO eligibility APIs (planned): AmeriHealth Caritas NE, PA Health & Wellness, UPMC CHC',
        'PROMISe MMIS (PA Medicaid MMIS, planned)',
      ]}
      nextSteps={[
        'Add `chc_mco_id` to authorizations so breakdown-by-MCO is real',
        'Wire PROMISe MMIS eligibility lookup endpoint',
        'Per-MCO prior auth tracker with 90-day quarterly review reminders',
      ]}
      related={[
        { label: 'Clients', to: '/admin/clients' },
        { label: 'Authorizations (CRUD)', to: '/admin/authorizations' },
        { label: 'Authorization Oversight', to: '/admin/compliance-engine/authorizations' },
      ]}
    >
      <div style={sectionCard}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          Refresh snapshot
        </h3>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            margin: '0.4rem 0 1rem',
          }}
        >
          Pick the &quot;as of&quot; date and refresh active MA cases, payers, service-mix breadth,
          and new authorizations in the last 30 days.
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

      {snapshot ? (
        <div style={{ ...sectionCard, marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
            CHC managed care organizations
          </h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.35rem 0 0.75rem',
            }}
          >
            PA covers 3 CHC MCOs. Once `chc_mco_id` lands on authorizations, this list becomes a
            per-MCO breakdown.
          </p>
          <ul
            style={{
              display: 'grid',
              gap: '0.4rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {snapshot.policy.chcMcos.map((mco) => (
              <li
                key={mco}
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  padding: '0.55rem 0.75rem',
                }}
              >
                {mco}
              </li>
            ))}
          </ul>
          <p
            style={{
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontSize: '0.8rem',
              margin: '1rem 0 0',
              paddingTop: '0.75rem',
            }}
          >
            CHC quarterly review cycle:{' '}
            <strong>{snapshot.policy.chcQuarterlyReviewDays} days</strong> (per 55 Pa. Code Chapter
            6000).
          </p>
        </div>
      ) : !loading && !error ? (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No snapshot loaded"
            body="Pick a date and click Refresh to load the Medicaid workflow snapshot."
          />
        </div>
      ) : null}
    </ComplianceModuleLayout>
  );
}
