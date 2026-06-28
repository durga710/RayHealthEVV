import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
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

  // Sandata aggregator submission
  const [sandataFrom, setSandataFrom] = useState<string>('');
  const [sandataTo, setSandataTo] = useState<string>(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const sandataQuery = () => {
    const params = new URLSearchParams();
    if (sandataFrom) params.set('from', sandataFrom);
    if (sandataTo) params.set('to', sandataTo);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const handleSandataSubmit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const result = await postJson<{ marked: number }>('/api/exports/sandata/submit', {
        from: sandataFrom || undefined,
        to: sandataTo || undefined,
      });
      setSubmitMsg({
        kind: 'ok',
        text: `${result.marked} verified visit${result.marked === 1 ? '' : 's'} marked as submitted to Sandata.`,
      });
    } catch (err) {
      setSubmitMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // HHAeXchange aggregator submission (for agencies routed through HHAeXchange
  // instead of Sandata; mirrors the Sandata lifecycle above).
  const [hhaxFrom, setHhaxFrom] = useState<string>('');
  const [hhaxTo, setHhaxTo] = useState<string>(todayIso());
  const [hhaxSubmitting, setHhaxSubmitting] = useState(false);
  const [hhaxMsg, setHhaxMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const hhaxQuery = () => {
    const params = new URLSearchParams();
    if (hhaxFrom) params.set('from', hhaxFrom);
    if (hhaxTo) params.set('to', hhaxTo);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const handleHhaxSubmit = async () => {
    setHhaxSubmitting(true);
    setHhaxMsg(null);
    try {
      const result = await postJson<{ marked: number }>('/api/exports/hhaexchange/submit', {
        from: hhaxFrom || undefined,
        to: hhaxTo || undefined,
      });
      setHhaxMsg({
        kind: 'ok',
        text: `${result.marked} verified visit${result.marked === 1 ? '' : 's'} marked as submitted to HHAeXchange.`,
      });
    } catch (err) {
      setHhaxMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Submission failed' });
    } finally {
      setHhaxSubmitting(false);
    }
  };

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

      <div style={{ ...sectionCard, marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          State EVV aggregator (Sandata)
        </h3>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            margin: '0.4rem 0 1rem',
          }}
        >
          Download the Sandata submission file for a date range, then record that the batch was
          sent. Until a visit is accepted by the aggregator, claim generation flags it at medium
          denial risk. Acceptance / rejection is written back from Sandata&apos;s response file via{' '}
          <code>POST /api/exports/sandata/reconcile</code>.
        </p>

        <div
          style={{
            alignItems: 'flex-end',
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            marginBottom: '1rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>From</span>
            <input
              type="date"
              value={sandataFrom}
              onChange={(event) => setSandataFrom(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>To</span>
            <input
              type="date"
              value={sandataTo}
              onChange={(event) => setSandataTo(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          <a
            href={`/api/exports/sandata.csv${sandataQuery()}`}
            style={{
              ...primaryButtonStyle,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            Download Sandata CSV
          </a>
          <a
            href={`/api/exports/visits.csv${sandataQuery()}`}
            style={{
              ...primaryButtonStyle,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            Download visits CSV
          </a>
          <button
            type="button"
            onClick={handleSandataSubmit}
            disabled={submitting}
            style={{ ...primaryButtonStyle, opacity: submitting ? 0.55 : 1 }}
          >
            {submitting ? 'Marking…' : 'Mark batch submitted'}
          </button>
        </div>

        {submitMsg ? (
          <div
            role={submitMsg.kind === 'err' ? 'alert' : 'status'}
            style={{
              backgroundColor:
                submitMsg.kind === 'err' ? 'var(--color-danger-bg)' : 'var(--color-success-bg, #ecfdf5)',
              border: `1px solid ${
                submitMsg.kind === 'err' ? 'var(--color-danger-border)' : 'var(--color-success-border, #a7f3d0)'
              }`,
              borderRadius: 10,
              color: submitMsg.kind === 'err' ? 'var(--color-danger)' : 'var(--color-success, #047857)',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: '1rem',
              padding: '0.75rem 1rem',
            }}
          >
            {submitMsg.text}
          </div>
        ) : null}
      </div>

      <div style={{ ...sectionCard, marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          State EVV aggregator (HHAeXchange)
        </h3>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            margin: '0.4rem 0 1rem',
          }}
        >
          For agencies whose state routes EVV through HHAeXchange. The CSV uses your HHAeXchange
          configuration (Tax ID, Provider ID, caregiver and service-code mappings) — configure it on{' '}
          Agency Setup first or the download returns 422. Acceptance / rejection is written back via{' '}
          <code>POST /api/exports/hhaexchange/reconcile</code>.
        </p>

        <div
          style={{
            alignItems: 'flex-end',
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            marginBottom: '1rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>From</span>
            <input
              type="date"
              value={hhaxFrom}
              onChange={(event) => setHhaxFrom(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>To</span>
            <input
              type="date"
              value={hhaxTo}
              onChange={(event) => setHhaxTo(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          <a
            href={`/api/exports/hhaexchange.csv${hhaxQuery()}`}
            style={{
              ...primaryButtonStyle,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            Download HHAeXchange CSV
          </a>
          <button
            type="button"
            onClick={handleHhaxSubmit}
            disabled={hhaxSubmitting}
            style={{ ...primaryButtonStyle, opacity: hhaxSubmitting ? 0.55 : 1 }}
          >
            {hhaxSubmitting ? 'Marking…' : 'Mark batch submitted'}
          </button>
        </div>

        {hhaxMsg ? (
          <div
            role={hhaxMsg.kind === 'err' ? 'alert' : 'status'}
            style={{
              backgroundColor:
                hhaxMsg.kind === 'err' ? 'var(--color-danger-bg)' : 'var(--color-success-bg, #ecfdf5)',
              border: `1px solid ${
                hhaxMsg.kind === 'err' ? 'var(--color-danger-border)' : 'var(--color-success-border, #a7f3d0)'
              }`,
              borderRadius: 10,
              color: hhaxMsg.kind === 'err' ? 'var(--color-danger)' : 'var(--color-success, #047857)',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: '1rem',
              padding: '0.75rem 1rem',
            }}
          >
            {hhaxMsg.text}
          </div>
        ) : null}
      </div>
    </ComplianceModuleLayout>
  );
}
