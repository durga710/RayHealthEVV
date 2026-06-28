import React, { useEffect, useRef, useState } from 'react';
import { getJson, postText } from '../../lib/api-client.js';
import { ComplianceModuleLayout, type KpiTile } from './ComplianceModuleLayout.js';

interface PreviewClaim {
  controlNumber: string;
  matched: boolean;
  derivedStatus: 'paid' | 'partial' | 'denied' | 'reversed';
  chargeCents: number;
  paidCents: number;
  patientResponsibilityCents: number;
  adjustments: { group: string; reasonCode: string; amountCents: number }[];
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
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadHistory = () => {
    getJson<RemittanceRow[]>('/api/billing/remittances')
      .then((d) => setHistory(d || []))
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, []);

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
      dataSources={['claims (matched on control_number)', 'claim_remittances']}
      nextSteps={[
        'Auto-ingest 835 files from the clearinghouse SFTP drop',
        'Service-line (SVC) level posting in addition to claim level',
        'CARC/RARC code dictionary for human-readable denial reasons',
      ]}
      related={[{ label: 'Claims', to: '/admin/compliance-engine/claims' }]}
    >
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
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {c.adjustments.map((a) => `${a.group}/${a.reasonCode} ${usd(a.amountCents)}`).join('; ')}
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
            Posted {result.posted} remittances — {result.matched} matched to claims,
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
                <th>Control #</th><th>Match</th><th>Charge</th><th>Paid</th><th>Adj</th><th>Trace</th>
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
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.traceNumber ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ComplianceModuleLayout>
  );
}
