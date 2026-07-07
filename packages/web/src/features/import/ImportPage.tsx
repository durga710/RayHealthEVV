import React, { useRef, useState } from 'react';
import { postText } from '../../lib/api-client.js';

type ImportEntity = 'clients' | 'caregivers' | 'authorizations';

interface PreviewRow {
  rowNumber: number;
  status: 'ok' | 'error';
  errors: string[];
}

interface PreviewResponse {
  entity: ImportEntity;
  total: number;
  okCount: number;
  errorCount: number;
  rows: PreviewRow[];
}

interface CommitResponse {
  entity: ImportEntity;
  created: number;
  updated: number;
  total: number;
}

const ENTITIES: { value: ImportEntity; label: string; blurb: string }[] = [
  {
    value: 'clients',
    label: 'Clients (members)',
    blurb: 'Demographics, Medicaid ID, address + geofence anchor. Import these first.',
  },
  {
    value: 'caregivers',
    label: 'Caregivers',
    blurb: 'Name, email, NPI, hire date. Matched on email so re-runs update in place.',
  },
  {
    value: 'authorizations',
    label: 'Authorizations',
    blurb: 'Service-code units per client. Links to a client via client_external_id, import clients first.',
  },
];

const card: React.CSSProperties = {
  background: 'var(--color-surface, #fff)',
  border: '1px solid var(--color-border, #E2E8F0)',
  borderRadius: 12,
  padding: '1.25rem',
  marginBottom: '1.25rem',
};

const primaryBtn: React.CSSProperties = {
  background: '#107480',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  padding: '0.55rem 1rem',
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  color: '#0F172A',
  cursor: 'pointer',
  fontWeight: 600,
  padding: '0.5rem 0.9rem',
  textDecoration: 'none',
  display: 'inline-block',
};

export function ImportPage() {
  const [entity, setEntity] = useState<ImportEntity>('clients');
  const [fileName, setFileName] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'committing'>('idle');
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const onEntityChange = (e: ImportEntity) => {
    setEntity(e);
    setCsvText('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    reset();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    reset();
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
      setError('Choose a CSV file first.');
      return;
    }
    setBusy('previewing');
    setError(null);
    setResult(null);
    try {
      const data = await postText<PreviewResponse>(`/api/import/${entity}/preview`, csvText);
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy('idle');
    }
  };

  const runCommit = async () => {
    setBusy('committing');
    setError(null);
    try {
      const data = await postText<CommitResponse>(`/api/import/${entity}/commit`, csvText);
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy('idle');
    }
  };

  const active = ENTITIES.find((x) => x.value === entity)!;
  const canCommit = preview !== null && preview.errorCount === 0 && preview.total > 0;
  const errorRows = preview?.rows.filter((r) => r.status === 'error') ?? [];

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Data Import</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Migrate clients, caregivers, and authorizations from HHAeXchange, Sandata, or a
            spreadsheet. Upload a CSV, preview validation, then commit. Re-running the same file
            updates existing records (matched on the source <code>external_id</code>) instead of
            duplicating.
          </p>
        </div>
      </header>

      {/* Step 1, choose dataset */}
      <div style={card}>
        <h3 className="section-title" style={{ marginTop: 0 }}>1 · Choose a dataset</h3>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {ENTITIES.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => onEntityChange(e.value)}
              style={{
                ...ghostBtn,
                ...(entity === e.value ? { borderColor: '#107480', color: '#107480', fontWeight: 700 } : {}),
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
        <p style={{ color: '#64748B', fontSize: '0.875rem', margin: 0 }}>{active.blurb}</p>
        <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <a href={`/api/import/${entity}/template.csv`} style={ghostBtn}>
            Download {active.label} template
          </a>
        </p>
      </div>

      {/* Step 2, upload + preview */}
      <div style={card}>
        <h3 className="section-title" style={{ marginTop: 0 }}>2 · Upload &amp; preview</h3>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} />
          <button
            type="button"
            style={{ ...primaryBtn, opacity: busy !== 'idle' || !csvText ? 0.55 : 1 }}
            disabled={busy !== 'idle' || !csvText}
            onClick={runPreview}
          >
            {busy === 'previewing' ? 'Validating…' : 'Preview'}
          </button>
          {fileName && <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{fileName}</span>}
        </div>

        {preview && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontWeight: 600 }}>
              <span>Total rows: {preview.total}</span>
              <span style={{ color: '#059669' }}>Valid: {preview.okCount}</span>
              <span style={{ color: preview.errorCount ? '#BE123C' : '#94A3B8' }}>
                Errors: {preview.errorCount}
              </span>
            </div>
            {errorRows.length > 0 && (
              <table className="data-table" style={{ marginTop: '0.75rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Row</th>
                    <th>Problems</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRows.slice(0, 100).map((r) => (
                    <tr key={r.rowNumber}>
                      <td>{r.rowNumber}</td>
                      <td style={{ color: '#BE123C' }}>{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {errorRows.length > 100 && (
              <p style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                Showing first 100 of {errorRows.length} error rows.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Step 3, commit */}
      <div style={card}>
        <h3 className="section-title" style={{ marginTop: 0 }}>3 · Commit</h3>
        <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: 0 }}>
          Commit is all-or-nothing: a file with any errors is refused and nothing is written. Fix
          the rows above and re-preview.
        </p>
        <button
          type="button"
          style={{ ...primaryBtn, opacity: !canCommit || busy !== 'idle' ? 0.55 : 1 }}
          disabled={!canCommit || busy !== 'idle'}
          onClick={runCommit}
        >
          {busy === 'committing' ? 'Importing…' : `Import ${preview?.okCount ?? 0} ${active.label}`}
        </button>

        {result && (
          <div
            role="status"
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              fontWeight: 600,
            }}
          >
            Imported {active.label}: {result.created} created, {result.updated} updated
            {' '}(of {result.total} rows).
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#BE123C',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
