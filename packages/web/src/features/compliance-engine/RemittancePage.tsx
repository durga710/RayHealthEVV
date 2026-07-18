import React, { useEffect, useRef, useState } from 'react';
import { getJson, postJson, postText } from '../../lib/api-client.js';
import { ComplianceModuleLayout, type KpiTile } from './ComplianceModuleLayout.js';

interface Adjustment {
  group: string;
  groupLabel?: string;
  reasonCode: string;
  amountCents: number;
  /** CARC dictionary description; null for codes outside the curated set. */
  description?: string | null;
}

interface Remark {
  code: string;
  /** RARC dictionary description; null for codes outside the curated set. */
  description?: string | null;
}

interface ServiceLine {
  procedureCode: string;
  modifiers: string[];
  chargeCents: number;
  paidCents: number;
  units: number;
  serviceDate: string | null;
  adjustments: Adjustment[];
  remarkCodes: Remark[];
}

interface PreviewClaim {
  controlNumber: string;
  matched: boolean;
  derivedStatus: 'paid' | 'partial' | 'denied' | 'reversed';
  chargeCents: number;
  paidCents: number;
  patientResponsibilityCents: number;
  adjustments: Adjustment[];
  remarkCodes: Remark[];
  serviceLines: ServiceLine[];
}

interface PreviewResponse {
  traceNumber: string | null;
  totalPaidCents: number;
  total: number;
  matchedCount: number;
  claims: PreviewClaim[];
}

interface PostResponse {
  posted: number;
  matched: number;
  unmatched: string[];
  totalPaidCents: number;
  traceNumber: string | null;
}

interface SweepSummary {
  agenciesProcessed: number;
  filesIngested: number;
  filesSkipped: number;
  claimsMatched: number;
  errors: string[];
  timedOut: boolean;
}

interface IngestedFile {
  id: string;
  fileName: string;
  transport: string;
  claimCount: number;
  matchedCount: number;
  totalPaidCents: number;
  traceNumber: string | null;
  ingestedAt: string;
}

interface RemittanceRow {
  id: string;
  controlNumber: string;
  matched: boolean;
  statusCode: string | null;
  chargeCents: number;
  paidCents: number;
  adjustmentCents: number;
  patientResponsibilityCents: number;
  traceNumber: string | null;
  postedAt: string | null;
  adjustments: Adjustment[];
  remarkCodes: Remark[];
  serviceLines: ServiceLine[];
}

/** "CO/45 — Charge exceeds fee schedule… ($12.00)"; bare code when undescribed. */
function adjText(a: Adjustment): string {
  const label = a.description ? `${a.group}/${a.reasonCode} — ${a.description}` : `${a.group}/${a.reasonCode}`;
  return `${label} (${usd(a.amountCents)})`;
}

function remarkText(r: Remark): string {
  return r.description ? `${r.code} — ${r.description}` : r.code;
}

/** Compact adjustment + remark detail block shared by preview and history rows. */
function AdjustmentDetail({ adjustments, remarks, lines }: {
  adjustments: Adjustment[];
  remarks: Remark[];
  lines: ServiceLine[];
}) {
  if (adjustments.length === 0 && remarks.length === 0 && lines.length === 0) {
    return <span style={{ color: '#94A3B8' }}>—</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem' }}>
      {adjustments.map((a, i) => (
        <div key={`a-${i}`} style={{ color: 'var(--color-text-muted)' }}>{adjText(a)}</div>
      ))}
      {remarks.map((r, i) => (
        <div key={`r-${i}`} style={{ color: '#7C3AED' }}>Remark {remarkText(r)}</div>
      ))}
      {lines.map((l, i) => (
        <div key={`l-${i}`} style={{ paddingLeft: '0.6rem', borderLeft: '2px solid #E2E8F0' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{l.procedureCode}{l.modifiers.length ? `:${l.modifiers.join(':')}` : ''}</span>
          {l.serviceDate ? ` ${l.serviceDate}` : ''} · {l.units} unit{l.units === 1 ? '' : 's'} · {usd(l.paidCents)} of {usd(l.chargeCents)}
          {l.adjustments.map((a, j) => (
            <div key={`la-${j}`} style={{ color: 'var(--color-text-muted)' }}>{adjText(a)}</div>
          ))}
          {l.remarkCodes.map((r, j) => (
            <div key={`lr-${j}`} style={{ color: '#7C3AED' }}>Remark {remarkText(r)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// Guard against null/undefined/NaN cents so a malformed row renders $0.00
// instead of "$NaN". Thousands separators come from Intl for legibility.
const usd = (cents: number) => usdFmt.format((Number.isFinite(cents) ? cents : 0) / 100);

const card: React.CSSProperties = {
  background: 'var(--color-surface, #fff)',
  border: '1px solid var(--color-border, #E2E8F0)',
  borderRadius: 12,
  padding: '1.25rem',
  marginTop: '1rem',
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--color-primary, #107480)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  padding: '0.55rem 1rem',
};

export function RemittancePage() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'posting'>('idle');
  const [result, setResult] = useState<PostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RemittanceRow[]>([]);
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadHistory = () => {
    getJson<RemittanceRow[]>('/api/billing/remittances')
      .then((d) => setHistory(d || []))
      .catch(() => setHistory([]));
    getJson<IngestedFile[]>('/api/billing/remittances/files')
      .then((d) => setIngestedFiles(d || []))
      .catch(() => setIngestedFiles([]));
  };
  useEffect(loadHistory, []);

  const runSweep = async () => {
    setSweeping(true);
    setSweepMsg(null);
    try {
      const summary = await postJson<SweepSummary>('/api/billing/remittances/sweep', {});
      const text =
        summary.filesIngested > 0
          ? `Fetched ${summary.filesIngested} file${summary.filesIngested === 1 ? '' : 's'}, matched ${summary.claimsMatched} claim${summary.claimsMatched === 1 ? '' : 's'}.`
          : summary.errors.length > 0
            ? summary.errors[0]
            : 'No new remittance files at the clearinghouse.';
      setSweepMsg({ tone: summary.errors.length > 0 && summary.filesIngested === 0 ? 'error' : 'success', text });
      loadHistory();
    } catch (err) {
      setSweepMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Fetch failed' });
    } finally {
      setSweeping(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreview(null);
    setResult(null);
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  };

  const runPreview = async () => {
    if (!csvText.trim()) {
      setError('Choose an 835 file first.');
      return;
    }
    setBusy('previewing');
    setError(null);
    setResult(null);
    try {
      setPreview(await postText<PreviewResponse>('/api/billing/remittances/preview', csvText));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy('idle');
    }
  };

  const runPost = async () => {
    setBusy('posting');
    setError(null);
    try {
      const r = await postText<PostResponse>('/api/billing/remittances/post', csvText);
      setResult(r);
      setPreview(null);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Posting failed');
    } finally {
      setBusy('idle');
    }
  };

  const kpis: KpiTile[] = [
    { label: 'Postings on file', value: history.length.toLocaleString() },
    {
      label: 'Total paid posted',
      value: usd(history.reduce((s, r) => s + r.paidCents, 0)),
      tone: 'accent',
    },
    {
      label: 'Unmatched',
      value: history.filter((r) => !r.matched).length.toLocaleString(),
      hint: 'no claim match',
    },
  ];

  return (
    <ComplianceModuleLayout
      title="Remittance (ERA / 835)"
      tagline="Post payer 835 electronic remittance advice back onto claims. Matched claims advance to paid / denied with the payer's adjustment reasons; the denial-risk loop closes."
      status="live"
      kpis={kpis}
      dataSources={['claims (matched on control_number)', 'claim_remittances', 'clearinghouse_remittance_files']}
      nextSteps={[
        'Remittances arrive automatically every 6 hours from the configured clearinghouse; use Fetch now for an immediate pull.',
        'Service-line (SVC) level posting in addition to claim level',
        'CARC/RARC code dictionary for human-readable denial reasons',
      ]}
      related={[{ label: 'Claims', to: '/admin/compliance-engine/claims' }, { label: 'Clearinghouse', to: '/admin/compliance-engine/clearinghouse' }]}
    >
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Automatic retrieval</h3>
          <button
            type="button"
            style={{ ...primaryBtn, opacity: sweeping ? 0.55 : 1 }}
            disabled={sweeping}
            onClick={runSweep}
          >
            {sweeping ? 'Fetching…' : 'Fetch from clearinghouse now'}
          </button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 0' }}>
          Pulls pending 835 files from the configured clearinghouse transport and posts them. Files
          already ingested are skipped automatically.
        </p>
        {sweepMsg && (
          <div
            role={sweepMsg.tone === 'error' ? 'alert' : 'status'}
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.9rem',
              borderRadius: 8,
              background: sweepMsg.tone === 'error' ? 'var(--color-danger-bg, #fef2f2)' : 'var(--color-success-bg, #ecfdf5)',
              color: sweepMsg.tone === 'error' ? 'var(--color-danger, #BE123C)' : 'var(--color-success, #047857)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {sweepMsg.text}
          </div>
        )}
        {ingestedFiles.length > 0 && (
          <table className="data-table" style={{ marginTop: '0.9rem' }}>
            <thead>
              <tr>
                <th>File</th><th>Transport</th><th>Claims</th><th>Matched</th><th>Total paid</th><th>Ingested</th>
              </tr>
            </thead>
            <tbody>
              {ingestedFiles.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{f.fileName}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{f.transport}</td>
                  <td>{f.claimCount}</td>
                  <td>{f.matchedCount}</td>
                  <td>{usd(f.totalPaidCents)}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{new Date(f.ingestedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Upload an 835</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 1rem' }}>
          Drop the payer&apos;s 835 file. Preview shows which claims match before you post; posting
          is atomic.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".835,.txt,.edi,text/plain" onChange={onFile} />
          <button
            type="button"
            style={{ ...primaryBtn, opacity: busy !== 'idle' || !csvText ? 0.55 : 1 }}
            disabled={busy !== 'idle' || !csvText}
            onClick={runPreview}
          >
            {busy === 'previewing' ? 'Parsing…' : 'Preview'}
          </button>
          {fileName && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{fileName}</span>}
        </div>

        {preview && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontWeight: 600 }}>
              <span>Claims in file: {preview.total}</span>
              <span style={{ color: '#059669' }}>Matched: {preview.matchedCount}</span>
              <span style={{ color: preview.total - preview.matchedCount ? '#BE123C' : '#94A3B8' }}>
                Unmatched: {preview.total - preview.matchedCount}
              </span>
              <span>Total paid: {usd(preview.totalPaidCents)}</span>
            </div>
            <table className="data-table" style={{ marginTop: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Control #</th><th>Match</th><th>Status</th><th>Charge</th><th>Paid</th><th>Adjustments</th>
                </tr>
              </thead>
              <tbody>
                {preview.claims.slice(0, 200).map((c) => (
                  <tr key={c.controlNumber}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{c.controlNumber}</td>
                    <td style={{ color: c.matched ? '#059669' : '#BE123C' }}>{c.matched ? 'yes' : 'no'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.derivedStatus}</td>
                    <td>{usd(c.chargeCents)}</td>
                    <td>{usd(c.paidCents)}</td>
                    <td>
                      <AdjustmentDetail adjustments={c.adjustments} remarks={c.remarkCodes ?? []} lines={c.serviceLines ?? []} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              style={{ ...primaryBtn, marginTop: '1rem', opacity: busy !== 'idle' ? 0.55 : 1 }}
              disabled={busy !== 'idle'}
              onClick={runPost}
            >
              {busy === 'posting' ? 'Posting…' : `Post ${preview.total} remittance${preview.total === 1 ? '' : 's'}`}
            </button>
          </div>
        )}

        {result && (
          <div
            role="status"
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'var(--color-success-bg, #ecfdf5)',
              border: '1px solid var(--color-success-border, #a7f3d0)',
              color: 'var(--color-success, #047857)',
              fontWeight: 600,
            }}
          >
            Posted {result.posted} remittances, {result.matched} matched to claims,
            {' '}{result.unmatched.length} unmatched. Total paid {usd(result.totalPaidCents)}.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: 'var(--color-danger-bg, #fef2f2)',
              border: '1px solid var(--color-danger-border, #fecaca)',
              color: 'var(--color-danger, #BE123C)',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800 }}>Recent postings</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Control #</th><th>Match</th><th>Charge</th><th>Paid</th><th>Adj</th><th>Why (CARC / RARC)</th><th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{r.controlNumber}</td>
                  <td style={{ color: r.matched ? '#059669' : '#BE123C' }}>{r.matched ? 'yes' : 'no'}</td>
                  <td>{usd(r.chargeCents)}</td>
                  <td>{usd(r.paidCents)}</td>
                  <td>{usd(r.adjustmentCents)}</td>
                  <td>
                    <AdjustmentDetail adjustments={r.adjustments ?? []} remarks={r.remarkCodes ?? []} lines={r.serviceLines ?? []} />
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.traceNumber ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ComplianceModuleLayout>
  );
}
