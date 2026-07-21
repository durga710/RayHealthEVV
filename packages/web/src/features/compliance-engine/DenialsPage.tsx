import React, { useEffect, useState } from 'react';
import { getJson, patchJson } from '../../lib/api-client.js';
import { ComplianceModuleLayout, ComplianceEmptyQueue, type KpiTile } from './ComplianceModuleLayout.js';

/**
 * Denial dashboard: KPIs + top payer denial reasons + a worklist that tracks
 * every denied/partial remittance to resolution. Runs entirely off posted
 * 835s (`claim_remittances`), matched to our claims or not, so it delivers
 * value from the first uploaded remittance file.
 */

interface Adjustment {
  group: string;
  groupLabel?: string;
  reasonCode: string;
  amountCents: number;
  description?: string | null;
}

interface ReasonSummary {
  group: string;
  groupLabel: string;
  reasonCode: string;
  description: string | null;
  occurrences: number;
  amountCents: number;
}

interface AgingBucket {
  label: string;
  count: number;
  atRiskCents: number;
}

interface Summary {
  totalRemittances: number;
  paidCount: number;
  partialCount: number;
  deniedCount: number;
  reversedCount: number;
  denialRatePct: number;
  chargeCents: number;
  paidCents: number;
  atRiskCents: number;
  unworkedCount: number;
  topReasons: ReasonSummary[];
  aging: AgingBucket[];
}

type WorkStatus = 'new' | 'working' | 'resubmitted' | 'appealed' | 'resolved' | 'written_off';

interface WorklistRow {
  id: string;
  claimId: string | null;
  controlNumber: string;
  matched: boolean;
  kind: 'denied' | 'partial';
  chargeCents: number;
  paidCents: number;
  atRiskCents: number;
  postedAt: string | null;
  traceNumber: string | null;
  adjustments: Adjustment[];
  denialStatus: WorkStatus;
  denialNote: string | null;
  denialUpdatedAt: string | null;
}

interface DenialsResponse {
  summary: Summary;
  worklist: WorklistRow[];
}

const WORK_STATUSES: Array<{ value: WorkStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'working', label: 'Working' },
  { value: 'resubmitted', label: 'Resubmitted' },
  { value: 'appealed', label: 'Appealed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'written_off', label: 'Written off' },
];

const OPEN_STATUSES: WorkStatus[] = ['new', 'working', 'resubmitted', 'appealed'];

function usd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const card: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.1rem 1.25rem',
  marginTop: '1rem',
};

const STATUS_COLOR: Record<WorkStatus, string> = {
  new: '#BE123C',
  working: '#B45309',
  resubmitted: '#1D4ED8',
  appealed: '#7C3AED',
  resolved: '#047857',
  written_off: '#64748B',
};

export function DenialsPage() {
  const [data, setData] = useState<DenialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = () => {
    getJson<DenialsResponse>('/api/billing/denials')
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError('Could not load the denial dashboard.'));
  };
  useEffect(load, []);

  const patchRow = async (id: string, patch: { status?: WorkStatus; note?: string | null }) => {
    setSavingId(id);
    try {
      await patchJson(`/api/billing/denials/${id}`, patch);
      load();
    } catch {
      setError('Could not save the worklist change.');
    } finally {
      setSavingId(null);
    }
  };

  const summary = data?.summary;
  const kpis: KpiTile[] = summary
    ? [
        {
          label: 'Denial rate',
          value: `${summary.denialRatePct.toFixed(1)}%`,
          hint: `${summary.deniedCount} of ${summary.paidCount + summary.partialCount + summary.deniedCount} adjudicated`,
          tone: summary.denialRatePct >= 10 ? 'warning' : 'success',
        },
        {
          label: 'Dollars at risk',
          value: usd(summary.atRiskCents),
          hint: 'denied + underpaid',
          tone: summary.atRiskCents > 0 ? 'accent' : 'neutral',
        },
        {
          label: 'Unworked',
          value: summary.unworkedCount.toLocaleString(),
          hint: 'denials not yet touched',
          tone: summary.unworkedCount > 0 ? 'warning' : 'success',
        },
        {
          label: 'Collected',
          value: usd(summary.paidCents),
          hint: `of ${usd(summary.chargeCents)} billed`,
        },
      ]
    : [];

  const rows = (data?.worklist ?? []).filter(
    (r) => showClosed || OPEN_STATUSES.includes(r.denialStatus),
  );

  return (
    <ComplianceModuleLayout
      title="Denials"
      tagline="Every denied or shaved remittance, with the payer's reason codes, tracked to resolution. Works from posted 835s alone — claims generated elsewhere still show up here."
      status="live"
      kpis={kpis}
      dataSources={['claim_remittances (posted 835s, matched or not)', 'CARC/RARC dictionary']}
      related={[
        { label: 'Remittance (ERA)', to: '/admin/compliance-engine/remittances' },
        { label: 'Claims', to: '/admin/compliance-engine/claims' },
      ]}
    >
      {error && (
        <div role="alert" style={{ ...card, borderColor: '#FECDD3', color: '#BE123C' }}>{error}</div>
      )}

      {summary && summary.topReasons.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Top denial reasons</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 0.8rem' }}>
            Ranked by dollars, across denied and underpaid remittances.
          </p>
          {summary.topReasons.map((r) => {
            const max = summary.topReasons[0].amountCents || 1;
            return (
              <div key={`${r.group}/${r.reasonCode}`} style={{ marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600 }}>
                    {r.group}/{r.reasonCode}
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                      {' '}— {r.description ?? r.groupLabel}
                    </span>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {usd(r.amountCents)} · {r.occurrences}×
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', marginTop: 4 }}>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      width: `${Math.max(4, Math.round((r.amountCents / max) * 100))}%`,
                      background: '#BE123C',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {summary && (
        <div style={card}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Denial aging</h3>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
            {summary.aging.map((b) => (
              <div key={b.label}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{b.label}</div>
                <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {b.count} · {usd(b.atRiskCents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Worklist</h3>
          <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Show resolved &amp; written off
          </label>
        </div>

        {data && rows.length === 0 ? (
          <ComplianceEmptyQueue
            title="No open denials"
            body="Every denied or underpaid remittance has been worked. New denials appear here as 835s are posted."
          />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.8rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Claim</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Posted</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Kind</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>At risk</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Reasons</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                    <td style={{ padding: '0.5rem 0.6rem', fontVariantNumeric: 'tabular-nums' }}>
                      {r.controlNumber}
                      {!r.matched && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          no claim match
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap' }}>{fmtDate(r.postedAt)}</td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{ color: r.kind === 'denied' ? '#BE123C' : '#B45309', fontWeight: 700 }}>
                        {r.kind === 'denied' ? 'Denied' : 'Underpaid'}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {usd(r.atRiskCents)}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', maxWidth: 280 }}>
                      {r.adjustments.length === 0
                        ? '—'
                        : r.adjustments.slice(0, 3).map((a) => (
                            <div key={`${a.group}/${a.reasonCode}`} style={{ marginBottom: 2 }}>
                              <strong>{a.group}/{a.reasonCode}</strong>
                              {a.description ? ` — ${a.description}` : ''}
                            </div>
                          ))}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>
                      <select
                        value={r.denialStatus}
                        disabled={savingId === r.id}
                        onChange={(e) => void patchRow(r.id, { status: e.target.value as WorkStatus })}
                        aria-label={`Worklist status for ${r.controlNumber}`}
                        style={{
                          padding: '0.3rem 0.4rem',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          color: STATUS_COLOR[r.denialStatus],
                          fontWeight: 700,
                        }}
                      >
                        {WORK_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', minWidth: 200 }}>
                      <textarea
                        value={noteDrafts[r.id] ?? r.denialNote ?? ''}
                        placeholder="Working note…"
                        rows={2}
                        aria-label={`Note for ${r.controlNumber}`}
                        onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          const prev = (r.denialNote ?? '').trim();
                          if (next !== prev) void patchRow(r.id, { note: next || null });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          fontSize: '0.82rem',
                          resize: 'vertical',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ComplianceModuleLayout>
  );
}
