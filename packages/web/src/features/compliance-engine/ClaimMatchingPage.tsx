import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface ClaimMatchingResponse {
  agencyId: string;
  asOf: string;
  counts: {
    verifiedVisitsLast7d: number;
    verifiedVisitsLast30d: number;
    flaggedVisitsLast7d: number;
    pendingVisits: number;
  };
  policy: {
    sandataSubmissionWindowDays: number;
  };
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

export function ClaimMatchingPage() {
  const [snapshot, setSnapshot] = useState<ClaimMatchingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<ClaimMatchingResponse>(
        '/api/compliance-engine/claims/overview',
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
    void load();
  }, []);

  const kpis: KpiTile[] = snapshot
    ? [
        {
          label: 'Claim-ready (7d)',
          value: snapshot.counts.verifiedVisitsLast7d.toLocaleString(),
          hint: 'status=verified',
          tone: 'success',
        },
        {
          label: 'Claim-ready (30d)',
          value: snapshot.counts.verifiedVisitsLast30d.toLocaleString(),
        },
        {
          label: 'Flagged (7d)',
          value: snapshot.counts.flaggedVisitsLast7d.toLocaleString(),
          tone: 'warning',
          hint: 'not claim-ready',
        },
        {
          label: 'Pending visits',
          value: snapshot.counts.pendingVisits.toLocaleString(),
          tone: snapshot.counts.pendingVisits > 0 ? 'accent' : 'neutral',
          hint: 'awaiting verification',
        },
      ]
    : [
        { label: 'Claim-ready (7d)', value: '—', tone: 'success' },
        { label: 'Claim-ready (30d)', value: '—' },
        { label: 'Flagged (7d)', value: '—', tone: 'warning' },
        { label: 'Pending visits', value: '—', tone: 'accent' },
      ];

  return (
    <ComplianceModuleLayout
      title="Claim Matching"
      tagline="Pair billable claims to verified EVV visits before submission. Sandata forwards to PROMISe MMIS; PA accepts real-time submission or batch within 7 days of the visit."
      status="beta"
      kpis={kpis}
      dataSources={[
        'EVV visits (status = pending / verified / flagged)',
        'authorizations table (per CHC MCO, planned)',
        'Sandata EVV aggregator → PROMISe MMIS',
        'Claims feed (planned — 837P or aggregator API)',
      ]}
      nextSteps={[
        'Claims feed ingest (837P or aggregator API)',
        'Match algorithm: caregiver + client + service code + visit window',
        'Denial-reason taxonomy + back-feed into Exception Resolution',
      ]}
      related={[
        { label: 'Authorizations (CRUD)', to: '/admin/authorizations' },
        { label: 'Visit Review', to: '/admin/review' },
        { label: 'Exception Resolution', to: '/admin/compliance-engine/exceptions' },
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
              Claim-readiness pipeline
            </h3>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.9rem',
                margin: '0.4rem 0 0',
              }}
            >
              Until a real claims feed lands, EVV status acts as the readiness signal: verified =
              claim-ready, flagged = needs work, pending = in-flight.
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

      {snapshot ? (
        <div style={{ ...sectionCard, marginTop: '1rem' }}>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: 0,
            }}
          >
            Snapshot as of <strong style={{ color: 'var(--color-text)' }}>{snapshot.asOf}</strong>.
            Sandata submission window:{' '}
            <strong>{snapshot.policy.sandataSubmissionWindowDays} days</strong> from visit date —
            verified visits should be submitted within this window for first-pass acceptance.
          </p>
        </div>
      ) : !loading && !error ? (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No snapshot loaded"
            body="Click Refresh to count claim-ready, flagged, and pending EVV visits for your agency."
          />
        </div>
      ) : null}
    </ComplianceModuleLayout>
  );
}
