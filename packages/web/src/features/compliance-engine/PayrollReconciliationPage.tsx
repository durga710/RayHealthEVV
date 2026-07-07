import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface PayrollReconciliationResponse {
  agencyId: string;
  asOf: string;
  counts: {
    verifiedHoursLast7d: number;
    verifiedHoursLast30d: number;
    completedVisitsLast7d: number;
    inProgressVisits: number;
  };
  policy: {
    gracePeriodMinutes: number;
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

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: '0.9rem',
  padding: '0.45rem 0.6rem',
};

function formatHours(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - 13 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PayrollReconciliationPage() {
  const [snapshot, setSnapshot] = useState<PayrollReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = defaultRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadFile(
        `/api/billing/payroll/export?from=${from}&to=${to}`,
        `payroll-${from}_to_${to}.csv`,
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Payroll export failed');
    } finally {
      setExporting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<PayrollReconciliationResponse>(
        '/api/compliance-engine/payroll/overview',
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
          label: 'Verified hours (7d)',
          value: formatHours(snapshot.counts.verifiedHoursLast7d),
          hint: 'EVV clock-out minus clock-in',
        },
        {
          label: 'Verified hours (30d)',
          value: formatHours(snapshot.counts.verifiedHoursLast30d),
        },
        {
          label: 'Completed visits (7d)',
          value: snapshot.counts.completedVisitsLast7d.toLocaleString(),
        },
        {
          label: 'In-progress shifts',
          value: snapshot.counts.inProgressVisits.toLocaleString(),
          tone: snapshot.counts.inProgressVisits > 0 ? 'accent' : 'neutral',
          hint: 'currently clocked in',
        },
      ]
    : [
        { label: 'Verified hours (7d)', value: ', ' },
        { label: 'Verified hours (30d)', value: ', ' },
        { label: 'Completed visits (7d)', value: ', ' },
        { label: 'In-progress shifts', value: ', ', tone: 'accent' },
      ];

  return (
    <ComplianceModuleLayout
      title="Payroll Reconciliation"
      tagline="Match EVV-verified caregiver hours against payroll using PA’s 15-minute grace window (FLSA de minimis aligned) so every paycheck is auditable to a clocked, geofence-validated visit."
      status="live"
      kpis={kpis}
      dataSources={[
        'EVV visits (verified clock-in/out durations)',
        'caregivers table (agency scope)',
        'Payroll feed integration (planned)',
      ]}
      nextSteps={[
        'Direct integrations with ADP / Paychex / Gusto (CSV export is live today)',
        'Weekly close + caregiver pay-period rollup honoring the 15-min grace',
        'Exception workflow: unverified hours, over/under pay, grace-window outliers',
      ]}
      related={[
        { label: 'Staff', to: '/admin/staff' },
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
              EVV-verified hours snapshot
            </h3>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.9rem',
                margin: '0.4rem 0 0',
              }}
            >
              Sums of clock_out − clock_in over the trailing 7 and 30 days for the agency, plus a
              live count of currently-in-progress shifts.
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

      {/* Payroll export */}
      <div style={{ ...sectionCard, marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          Export payroll
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 0.9rem' }}>
          Download a payroll-ready CSV of EVV-verified hours per caregiver for a pay period, visit
          time totaled per caregiver, ready to import into your payroll provider.
        </p>
        <div style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', fontWeight: 700, gap: 4 }}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', fontWeight: 700, gap: 4 }}>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </label>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportCsv()}
            style={{ ...primaryButtonStyle, opacity: exporting ? 0.55 : 1 }}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
        {exportError ? (
          <div role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 700, marginTop: '0.75rem' }}>
            {exportError}
          </div>
        ) : null}
      </div>

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
            Grace window: <strong>±{snapshot.policy.gracePeriodMinutes} minutes</strong> (FLSA de
            minimis aligned). Pay-period close will round payroll-eligible time against this window.
          </p>
        </div>
      ) : !loading && !error ? (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No snapshot loaded"
            body="Click Refresh to load the EVV-verified hours snapshot for the trailing 7 / 30 days."
          />
        </div>
      ) : null}
    </ComplianceModuleLayout>
  );
}
