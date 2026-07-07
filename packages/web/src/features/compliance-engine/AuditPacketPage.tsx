import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getJson, ApiError } from '../../lib/api-client.js';
import {
  PageShell,
  PageHeader,
  SectionCard,
  StatusPill,
  Timeline,
  DataTable,
  EmptyState,
  ErrorRetry,
  LoadingSkeleton,
  type StatusTone,
  type TimelineItem
} from '../../components/index.js';

/**
 * Per-visit deep audit packet, the print-friendly companion to Audit Defense
 * (which covers a date range with counts + a manifest hash). This page
 * renders GET /admin/audit-packet/:visitId exactly (see
 * docs/agent-reports/06-audit-packet-architecture.md §3.3): a whitelist of
 * evidence fields, never raw GPS coordinates, never a raw audit payload.
 *
 * MVP export = browser print-to-PDF via the "Print packet" button + the
 * `@media print` rules in index.css. No server-side PDF pipeline exists or
 * is introduced here.
 */

type GeofenceResultKind = 'within' | 'out_of_bounds' | 'not_configured' | 'not_captured';

interface GeofenceFacts {
  captured: boolean;
  accuracyM: number | null;
  result: GeofenceResultKind;
  distanceM: number | null;
  allowedM: number | null;
}

interface AuditPacketResponse {
  packet: { generatedAt: string; generatedBy: string; agencyId: string; integritySha256: string };
  visit: {
    id: string;
    status: 'pending' | 'verified' | 'flagged';
    serviceCode: string | null;
    serviceDescription: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    clockInTime: string;
    clockOutTime: string | null;
  };
  caregiver: { id: string; name: string };
  client: { id: string | null; name: string | null };
  curesActElements: Record<string, boolean>;
  geofence: { clockIn: GeofenceFacts; clockOut: GeofenceFacts };
  exceptions: Array<{
    id: string;
    exceptionType: string;
    reason: string;
    status: 'open' | 'resolved';
    resolvedBy: string | null;
    resolvedAt: string | null;
  }>;
  corrections: Array<{
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    requesterId: string;
    requesterName: string | null;
    reason: string;
    reasonCategoryCode: string | null;
    correctionCode: string | null;
    approverId: string | null;
    approverName: string | null;
    approvedAt: string | null;
    originalStartTime: string | null;
    originalEndTime: string | null;
    adjustedStartTime: string | null;
    adjustedEndTime: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    eventType: string;
    entityType: string;
    outcome: 'success' | 'failure' | 'denied';
    actorId: string;
    actorType: 'user' | 'service' | 'system';
    occurredAt: string;
    payloadSha256: string;
  }>;
  aggregator: {
    sandataStatus: string | null;
    sandataConfirmationId: string | null;
    hhaexchangeStatus: string | null;
    hhaexchangeConfirmationId: string | null;
  };
}

const VISIT_STATUS_TONE: Record<AuditPacketResponse['visit']['status'], StatusTone> = {
  pending: 'warning',
  verified: 'success',
  flagged: 'danger'
};

const GEOFENCE_TONE: Record<GeofenceResultKind, StatusTone> = {
  within: 'success',
  out_of_bounds: 'danger',
  not_configured: 'warning',
  not_captured: 'neutral'
};

const GEOFENCE_LABEL: Record<GeofenceResultKind, string> = {
  within: 'Within geofence',
  out_of_bounds: 'Out of bounds',
  not_configured: 'Not configured',
  not_captured: 'Not captured'
};

const EXCEPTION_TONE: Record<'open' | 'resolved', StatusTone> = { open: 'warning', resolved: 'success' };
const CORRECTION_TONE: Record<'pending' | 'approved' | 'rejected', StatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger'
};
const OUTCOME_TONE: Record<'success' | 'failure' | 'denied', 'success' | 'danger' | 'warning'> = {
  success: 'success',
  failure: 'danger',
  denied: 'warning'
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ', ';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function shortId(id: string | null | undefined): string {
  return id ? `${id.slice(0, 8)}…` : ', ';
}

/** Small label/value grid used for the visit summary and packet metadata. Uses only CSS-variable colors, no inline hex, per the design-system token rule. */
function KeyValueGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem 1.5rem',
        margin: 0
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt
            style={{
              margin: 0,
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)'
            }}
          >
            {item.label}
          </dt>
          <dd style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GeofenceCard({ label, facts }: { label: string; facts: GeofenceFacts }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
      <StatusPill label={GEOFENCE_LABEL[facts.result]} tone={GEOFENCE_TONE[facts.result]} dot />
      <KeyValueGrid
        items={[
          { label: 'Captured', value: facts.captured ? 'Yes' : 'No' },
          { label: 'GPS accuracy', value: facts.accuracyM != null ? `${facts.accuracyM} m` : ', ' },
          { label: 'Distance from client', value: facts.distanceM != null ? `${facts.distanceM} m` : ', ' },
          { label: 'Allowed radius', value: facts.allowedM != null ? `${facts.allowedM} m` : ', ' }
        ]}
      />
    </div>
  );
}

export function AuditPacketPage() {
  const { visitId } = useParams<{ visitId?: string }>();
  const navigate = useNavigate();
  const [lookupValue, setLookupValue] = useState('');
  const [data, setData] = useState<AuditPacketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPacket = useCallback(() => {
    if (!visitId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    getJson<AuditPacketResponse>(`/api/admin/audit-packet/${encodeURIComponent(visitId)}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        setData(null);
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load audit packet');
      })
      .finally(() => setLoading(false));
  }, [visitId]);

  useEffect(() => {
    fetchPacket();
  }, [fetchPacket]);

  const handleLookupSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = lookupValue.trim();
    if (trimmed) navigate(`/admin/audit-packet/${encodeURIComponent(trimmed)}`);
  };

  if (!visitId) {
    return (
      <PageShell>
        <PageHeader
          title="Audit Packet"
          subtitle="Look up a single visit to assemble its EVV audit-defense evidence, counts, statuses, hashes, and the accountability trail. Never a PHI dump."
        />
        <SectionCard title="Find a visit" bordered>
          <form
            onSubmit={handleLookupSubmit}
            style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 320px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Visit ID
              </span>
              <input
                type="text"
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                placeholder="e.g. 00000000-0000-4000-8000-000000000000"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text)',
                  fontSize: '0.9rem',
                  padding: '0.55rem 0.75rem'
                }}
              />
            </label>
            <button type="submit" className="btn-primary">
              View packet
            </button>
          </form>
        </SectionCard>
      </PageShell>
    );
  }

  const auditTimelineItems: TimelineItem[] = data
    ? data.auditEvents.map((e) => ({
        id: e.id,
        timestamp: formatDateTime(e.occurredAt),
        title: `${e.eventType} · ${e.outcome}`,
        description: `entity ${e.entityType} · actor ${shortId(e.actorId)} (${e.actorType}) · payload sha256 ${e.payloadSha256.slice(0, 16)}…`,
        tone: OUTCOME_TONE[e.outcome]
      }))
    : [];

  return (
    <PageShell>
      <PageHeader
        eyebrow={{ label: 'Audit Events', to: '/admin/audit-events' }}
        title="Audit Packet"
        subtitle={
          visitId ? (
            <>
              Visit-level EVV compliance evidence for PA DHS / Sandata audit response. Visit <code>{visitId}</code>.
            </>
          ) : undefined
        }
        actions={
          <button
            type="button"
            className="btn-primary no-print"
            onClick={() => window.print()}
            disabled={!data}
          >
            Print packet
          </button>
        }
      />

      {loading && <LoadingSkeleton rows={6} columns={2} />}

      {!loading && notFound && (
        <EmptyState
          title="Visit not found"
          body="This visit does not exist, or does not belong to your agency."
        />
      )}

      {!loading && !notFound && error && <ErrorRetry message={error} onRetry={fetchPacket} />}

      {!loading && !notFound && !error && data && (
        <div className="audit-packet">
          {/* Print-only running header, hidden on screen, shown on every printed page (index.css @media print). */}
          <div className="audit-packet__print-header" aria-hidden="true">
            <span>RayHealth EVV. Audit Packet</span>
            <span>Visit {data.visit.id}</span>
            <span>Generated {formatDateTime(data.packet.generatedAt)}</span>
            <span>SHA-256 {data.packet.integritySha256.slice(0, 16)}…</span>
          </div>

          <SectionCard title="Visit summary" bordered>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <StatusPill label={data.visit.status} tone={VISIT_STATUS_TONE[data.visit.status]} dot />
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Caregiver <strong style={{ color: 'var(--color-text)' }}>{data.caregiver.name || shortId(data.caregiver.id)}</strong>
                  {' · '}
                  Client{' '}
                  <strong style={{ color: 'var(--color-text)' }}>
                    {data.client.name ?? (data.client.id ? shortId(data.client.id) : ', ')}
                  </strong>
                </span>
              </div>
              <KeyValueGrid
                items={[
                  { label: 'Service code', value: data.visit.serviceCode ?? ', ' },
                  { label: 'Service description', value: data.visit.serviceDescription ?? ', ' },
                  { label: 'Scheduled start', value: formatDateTime(data.visit.scheduledStartTime) },
                  { label: 'Scheduled end', value: formatDateTime(data.visit.scheduledEndTime) },
                  { label: 'Clock-in', value: formatDateTime(data.visit.clockInTime) },
                  { label: 'Clock-out', value: formatDateTime(data.visit.clockOutTime) }
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="21st Century Cures Act elements">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {Object.entries(data.curesActElements).map(([point, present]) => (
                <StatusPill
                  key={point}
                  label={point}
                  tone={present ? 'success' : 'danger'}
                  dot
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Geofence verification">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              <GeofenceCard label="Clock-in" facts={data.geofence.clockIn} />
              <GeofenceCard label="Clock-out" facts={data.geofence.clockOut} />
            </div>
          </SectionCard>

          <SectionCard title="Exceptions">
            <DataTable
              columns={[
                { key: 'type', header: 'Type', render: (r) => r.exceptionType },
                { key: 'reason', header: 'Reason', render: (r) => r.reason },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => <StatusPill label={r.status} tone={EXCEPTION_TONE[r.status]} />
                },
                { key: 'resolvedBy', header: 'Resolved by', render: (r) => shortId(r.resolvedBy) },
                { key: 'resolvedAt', header: 'Resolved at', render: (r) => formatDateTime(r.resolvedAt) }
              ]}
              rows={data.exceptions}
              getRowKey={(r) => r.id}
              empty={{ title: 'No exceptions filed', body: 'No EVV exceptions were filed against this visit.' }}
            />
          </SectionCard>

          <SectionCard title="Corrections (VMUR trail)">
            <DataTable
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => <StatusPill label={r.status} tone={CORRECTION_TONE[r.status]} />
                },
                { key: 'requester', header: 'Requester', render: (r) => r.requesterName ?? shortId(r.requesterId) },
                { key: 'reason', header: 'Reason', render: (r) => r.reason },
                { key: 'category', header: 'Category', render: (r) => r.reasonCategoryCode ?? ', ' },
                { key: 'correction', header: 'Correction', render: (r) => r.correctionCode ?? ', ' },
                { key: 'approver', header: 'Approver', render: (r) => r.approverName ?? shortId(r.approverId) },
                { key: 'approvedAt', header: 'Approved at', render: (r) => formatDateTime(r.approvedAt) },
                { key: 'adjustedStart', header: 'Adjusted start', render: (r) => formatDateTime(r.adjustedStartTime) },
                { key: 'adjustedEnd', header: 'Adjusted end', render: (r) => formatDateTime(r.adjustedEndTime) }
              ]}
              rows={data.corrections}
              getRowKey={(r) => r.id}
              empty={{ title: 'No corrections', body: 'No visit-maintenance (VMUR) corrections were filed for this visit.' }}
            />
          </SectionCard>

          <SectionCard title="Audit-event chain">
            <Timeline items={auditTimelineItems} emptyLabel="No audit events recorded for this visit." />
          </SectionCard>

          <SectionCard title="Aggregator submission status">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <KeyValueGrid
                items={[
                  { label: 'Sandata status', value: data.aggregator.sandataStatus ?? 'Not submitted' },
                  { label: 'Sandata confirmation', value: data.aggregator.sandataConfirmationId ?? ', ' },
                  { label: 'HHAeXchange status', value: data.aggregator.hhaexchangeStatus ?? 'Not submitted' },
                  { label: 'HHAeXchange confirmation', value: data.aggregator.hhaexchangeConfirmationId ?? ', ' }
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard title="Packet integrity">
            <KeyValueGrid
              items={[
                { label: 'Generated at', value: formatDateTime(data.packet.generatedAt) },
                { label: 'Generated by', value: shortId(data.packet.generatedBy) },
                { label: 'Agency', value: shortId(data.packet.agencyId) },
                {
                  label: 'SHA-256 integrity hash',
                  value: (
                    <code style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {data.packet.integritySha256}
                    </code>
                  )
                }
              ]}
            />
            <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
              An auditor can re-derive this hash from the packet contents alone, server signatures are not trusted.
            </p>
          </SectionCard>
        </div>
      )}
    </PageShell>
  );
}
