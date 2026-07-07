import React, { useState } from 'react';
import { getJson } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface PacketDownloadResult {
  manifestSha256: string;
  counts: {
    auditEvents: number;
    vmurRecords: number;
    evvVisits: number;
    activeCaregivers: number;
  };
  filename: string;
}

/**
 * Download the audit-defense CSV packet for [from, to]. Uses fetch + Blob so
 * we can read the `X-Manifest-Sha256` header and surface it in the UI, that
 * hash is what a PA DHS auditor uses to confirm the file was not edited. Falls
 * back to throwing on non-2xx so the caller can render a message.
 */
async function downloadAuditDefensePacket(
  from: string,
  to: string,
): Promise<PacketDownloadResult> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(
    `/api/compliance-engine/audit-defense/packet.csv?${params.toString()}`,
    { credentials: 'include', headers: { accept: 'text/csv' } },
  );
  if (!response.ok) {
    throw new Error(`Failed to build packet: ${response.status}`);
  }
  const manifestSha256 = response.headers.get('x-manifest-sha256') ?? '';
  const counts = {
    auditEvents: Number(response.headers.get('x-packet-audit-events') ?? 0),
    vmurRecords: Number(response.headers.get('x-packet-vmur-records') ?? 0),
    evvVisits: Number(response.headers.get('x-packet-evv-visits') ?? 0),
    activeCaregivers: Number(response.headers.get('x-packet-active-caregivers') ?? 0),
  };
  const filenameMatch = /filename="([^"]+)"/.exec(
    response.headers.get('content-disposition') ?? '',
  );
  const filename = filenameMatch?.[1] ?? `audit-defense-packet-${from}-${to}.csv`;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { manifestSha256, counts, filename };
}

interface AuditDefensePreviewResponse {
  agencyId: string;
  periodFrom: string;
  periodTo: string;
  counts: {
    auditEvents: number;
    vmurRecords: number;
    evvVisits: number;
    activeCaregivers: number;
  };
  policy: {
    retentionFloorYears: number;
    dhsResponseSlaHours: number;
  };
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultFromDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return toDateInput(d);
}

function defaultToDate(): string {
  return toDateInput(new Date());
}

function formatIsoForDisplay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toUTCString().replace('GMT', 'UTC');
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

export function AuditDefensePage() {
  const [from, setFrom] = useState<string>(defaultFromDate());
  const [to, setTo] = useState<string>(defaultToDate());
  const [preview, setPreview] = useState<AuditDefensePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<PacketDownloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuild = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<AuditDefensePreviewResponse>(
        `/api/compliance-engine/audit-defense/preview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Failed to build preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const result = await downloadAuditDefensePacket(from, to);
      setLastDownload(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download packet');
    } finally {
      setDownloading(false);
    }
  };

  const kpis: KpiTile[] = preview
    ? [
        { label: 'Audit events (range)', value: preview.counts.auditEvents.toLocaleString() },
        { label: 'VMUR corrections (range)', value: preview.counts.vmurRecords.toLocaleString() },
        { label: 'EVV visits (range)', value: preview.counts.evvVisits.toLocaleString() },
        {
          label: 'Active caregivers',
          value: preview.counts.activeCaregivers.toLocaleString(),
          hint: 'snapshot as of now',
        },
      ]
    : [
        { label: 'Retention floor', value: '7 years', hint: 'PA: longest in U.S.' },
        { label: 'DHS response SLA', value: '48h' },
        { label: 'Audit events (range)', value: ', ' },
        { label: 'VMUR corrections (range)', value: ', ' },
      ];

  return (
    <ComplianceModuleLayout
      title="Audit Defense"
      tagline="Assemble defensible audit packets from EVV records, VMUR corrections, audit_events, and the Sandata export. PA DHS audit responses are due within 48 hours, and records must be retained for 7 years (the longest in the nation)."
      status="live"
      kpis={kpis}
      dataSources={[
        'audit_events (append-only, retained 7 years per 55 Pa. Code §51.25)',
        'Visit Maintenance (VMUR) records',
        'Sandata CSV export pipeline (PROMISe MMIS endpoint)',
        'caregivers + credentials roster (5-year background-check cycle)',
      ]}
      nextSteps={[
        'PDF rendering layer (currently CSV with SHA-256 manifest)',
        'Cross-module drill-down from each count tile into the underlying queue',
        'Scheduled background packets for routine DHS submissions',
      ]}
      related={[
        { label: 'Visit Review', to: '/admin/review' },
        { label: 'Corrections Queue', to: '/admin/corrections' },
      ]}
    >
      <div style={sectionCard}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          Preview a defense packet
        </h3>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            margin: '0.5rem 0 1rem',
          }}
        >
          Pick a date range. The preview counts the audit_events, VMUR corrections, EVV visits, and
          active caregivers that would land in a PA DHS defense packet, sized to the 48-hour
          response window.
        </p>
        <form
          onSubmit={handleBuild}
          style={{
            alignItems: 'flex-end',
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto auto',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={loading || !from || !to}
            style={{ ...primaryButtonStyle, opacity: loading || !from || !to ? 0.55 : 1 }}
          >
            {loading ? 'Building…' : 'Build preview'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading || !from || !to}
            style={{
              ...primaryButtonStyle,
              /* Deep Red accent, the regulator-facing CSV export is the one place we
                 want the brand's secondary color to land hardest. */
              backgroundColor: 'var(--color-accent)',
              opacity: downloading || !from || !to ? 0.55 : 1,
            }}
          >
            {downloading ? 'Downloading…' : 'Download CSV packet'}
          </button>
        </form>
      </div>

      {lastDownload ? (
        <div
          style={{
            ...sectionCard,
            backgroundColor: 'var(--color-success-bg)',
            borderColor: 'var(--color-success-border)',
            marginTop: '1rem',
          }}
          role="status"
        >
          <h4 style={{ color: 'var(--color-success)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
            Packet downloaded: <code style={{ fontWeight: 700 }}>{lastDownload.filename}</code>
          </h4>
          <p
            style={{
              color: 'var(--color-success)',
              fontSize: '0.85rem',
              lineHeight: 1.55,
              margin: '0.45rem 0 0.6rem',
            }}
          >
            {lastDownload.counts.auditEvents.toLocaleString()} audit events,{' '}
            {lastDownload.counts.vmurRecords.toLocaleString()} VMUR records,{' '}
            {lastDownload.counts.evvVisits.toLocaleString()} EVV visits, and{' '}
            {lastDownload.counts.activeCaregivers.toLocaleString()} active caregivers in this packet.
          </p>
          <p
            style={{
              color: 'var(--color-success)',
              fontSize: '0.78rem',
              margin: 0,
              wordBreak: 'break-all',
            }}
          >
            <strong>Manifest SHA-256</strong>:&nbsp;
            <code>{lastDownload.manifestSha256}</code>
          </p>
          <p
            style={{
              color: 'var(--color-success)',
              fontSize: '0.72rem',
              fontStyle: 'italic',
              margin: '0.5rem 0 0',
            }}
          >
            A PA DHS auditor can re-derive this hash from the file alone, server signatures are not trusted.
          </p>
        </div>
      ) : null}

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

      {preview ? (
        <div style={{ ...sectionCard, marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
            Packet preview
          </h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.35rem 0 0.75rem',
            }}
          >
            Range&nbsp;
            <strong style={{ color: 'var(--color-text)' }}>
              {formatIsoForDisplay(preview.periodFrom)}
            </strong>
            &nbsp;→&nbsp;
            <strong style={{ color: 'var(--color-text)' }}>
              {formatIsoForDisplay(preview.periodTo)}
            </strong>
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
            <li>
              <span style={labelStyle}>Audit events</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {preview.counts.auditEvents.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>VMUR corrections</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {preview.counts.vmurRecords.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>EVV visits</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {preview.counts.evvVisits.toLocaleString()}
              </p>
            </li>
            <li>
              <span style={labelStyle}>Active caregivers</span>
              <p style={{ color: 'var(--color-text)', fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>
                {preview.counts.activeCaregivers.toLocaleString()}
              </p>
            </li>
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
            Policy: retention <strong>{preview.policy.retentionFloorYears} years</strong> · DHS
            response SLA <strong>{preview.policy.dhsResponseSlaHours}h</strong>
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No preview built yet"
            body="Pick a date range above and click Build preview to count the records that would land in a defense packet."
          />
        </div>
      )}
    </ComplianceModuleLayout>
  );
}
