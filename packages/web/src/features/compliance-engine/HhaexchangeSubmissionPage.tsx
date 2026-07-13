import React, { useEffect, useState } from 'react';
import { getJson, putJson, postJson, ApiError } from '../../lib/api-client.js';
import { ComplianceModuleLayout, type KpiTile } from './ComplianceModuleLayout.js';

interface HhaexchangeConfig {
  agencyId: string;
  agencyTaxId: string | null;
  hhaProviderId: string | null;
  timezone: string;
  caregivers: unknown[];
  services: unknown[];
  enabled: boolean;
  apiBaseUrl: string | null;
  hasCredentials: boolean;
}

interface SubmitOk {
  status: 'ok';
  batchId: string;
  submitted: number;
  accepted: number;
  rejected: number;
}

const card: React.CSSProperties = {
  background: 'var(--color-surface, #fff)',
  border: '1px solid var(--color-border, #E2E8F0)',
  borderRadius: 12,
  padding: '1.25rem',
  marginTop: '1rem',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginBottom: '0.35rem' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.7rem', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: 8, fontSize: '0.9rem' };
const primaryBtn: React.CSSProperties = { background: 'var(--color-primary, #107480)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 700, padding: '0.55rem 1.1rem' };
const fieldRow: React.CSSProperties = { marginBottom: '1rem' };
const hint: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--color-text-muted, #64748B)', marginTop: '0.3rem' };

function banner(tone: 'error' | 'success' | 'info', text: string) {
  const palette = {
    error: { bg: 'var(--color-accent-bg, #FEF2F2)', fg: 'var(--color-accent, #B91C1C)' },
    success: { bg: 'var(--color-success-bg, #ECFDF5)', fg: 'var(--color-success, #047857)' },
    info: { bg: 'var(--color-primary-bg, #ECFEFF)', fg: 'var(--color-primary-dark, #0E7490)' },
  }[tone];
  return (
    <div style={{ background: palette.bg, color: palette.fg, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.85rem', marginTop: '0.75rem' }}>{text}</div>
  );
}

export function HhaexchangeSubmissionPage() {
  const [config, setConfig] = useState<HhaexchangeConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [agencyTaxId, setAgencyTaxId] = useState('');
  const [hhaProviderId, setHhaProviderId] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitOk | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const applyConfig = (c: HhaexchangeConfig) => {
    setConfig(c);
    setAgencyTaxId(c.agencyTaxId ?? '');
    setHhaProviderId(c.hhaProviderId ?? '');
    setApiBaseUrl(c.apiBaseUrl ?? '');
    setTimezone(c.timezone || 'America/New_York');
    setEnabled(c.enabled);
  };

  useEffect(() => {
    getJson<{ success: boolean; data: HhaexchangeConfig }>('/api/agencies/me/hhaexchange-config')
      .then((r) => applyConfig(r.data))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load HHAeXchange config'));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        agencyTaxId: agencyTaxId.trim() || null,
        hhaProviderId: hhaProviderId.trim() || null,
        apiBaseUrl: apiBaseUrl.trim() || null,
        timezone,
        enabled,
      };
      const creds: Record<string, string> = {};
      if (apiKey.trim()) creds.apiKey = apiKey.trim();
      if (username.trim()) creds.username = username.trim();
      if (password) creds.password = password;
      if (Object.keys(creds).length > 0) body.credentials = creds;

      const r = await putJson<{ success: boolean; data: HhaexchangeConfig }>('/api/agencies/me/hhaexchange-config', body);
      applyConfig(r.data);
      setApiKey('');
      setUsername('');
      setPassword('');
      setSaveMsg({ tone: 'success', text: 'HHAeXchange configuration saved.' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Save failed';
      setSaveMsg({ tone: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);
    try {
      const r = await postJson<SubmitOk>('/api/exports/hhaexchange/submit', { from: from || undefined, to: to || undefined });
      setSubmitResult(r);
    } catch (err) {
      if (err instanceof ApiError) {
        const b = (err.body ?? {}) as { status?: string; reason?: string; message?: string };
        if (b.status === 'not_configured') setSubmitError(`Not configured: ${b.reason ?? 'finish the configuration above and enable the integration.'}`);
        else if (b.status === 'error') setSubmitError(b.message ?? err.message);
        else setSubmitError(err.message);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const kpis: KpiTile[] = [
    { label: 'Tax ID', value: config?.agencyTaxId ? 'Set' : 'Missing', tone: config?.agencyTaxId ? 'success' : 'warning' },
    { label: 'Provider ID', value: config?.hhaProviderId ? 'Set' : 'Missing', tone: config?.hhaProviderId ? 'success' : 'warning' },
    { label: 'Credentials', value: config?.hasCredentials ? 'Stored' : 'Missing', tone: config?.hasCredentials ? 'success' : 'warning' },
    { label: 'Status', value: config?.enabled ? 'Enabled' : 'Disabled', tone: config?.enabled ? 'success' : 'neutral' },
  ];

  return (
    <ComplianceModuleLayout
      title="EVV Submission — HHAeXchange"
      tagline="Configure HHAeXchange onboarding inputs. Pennsylvania production delivery requires the official V5 file, SFTP onboarding, payer code tables, validation, and issued credentials."
      status="scaffold"
      kpis={kpis}
      dataSources={['agency_hhaexchange_config', 'evv_visits']}
      nextSteps={[
        'Complete HHAeXchange third-party vendor onboarding and obtain the payer-specific PA EDI code table.',
        'Use the CSV only to review RayHealth identity mappings; it is not the official PA Homecare V5 upload file.',
      ]}
      related={[{ label: 'EVV Submission — Sandata', to: '/admin/compliance-engine/evv-submission' }, { label: 'Go-Live Checklist', to: '/admin/readiness' }]}
    >
      {loadError && banner('error', loadError)}

      <form style={card} onSubmit={onSave}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--color-text, #0F172A)' }}>Configuration</h3>
        <p style={{ ...hint, marginTop: 0, marginBottom: '1rem' }}>Credentials are encrypted at rest and never displayed. Leave the credential fields blank to keep the stored values.</p>

        <div style={fieldRow}>
          <label style={label} htmlFor="agencyTaxId">Agency Tax ID (EIN)</label>
          <input id="agencyTaxId" style={input} value={agencyTaxId} onChange={(e) => setAgencyTaxId(e.target.value)} placeholder="9-digit EIN, no dash" inputMode="numeric" />
        </div>
        <div style={fieldRow}>
          <label style={label} htmlFor="hhaProviderId">HHAeXchange Provider ID</label>
          <input id="hhaProviderId" style={input} value={hhaProviderId} onChange={(e) => setHhaProviderId(e.target.value)} placeholder="Provider ID" />
        </div>
        <div style={fieldRow}>
          <label style={label} htmlFor="apiBaseUrl">Onboarding endpoint (reserved)</label>
          <input id="apiBaseUrl" style={input} value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://api.hhaexchange.com/..." />
        </div>
        <div style={fieldRow}>
          <label style={label} htmlFor="timezone">Timezone</label>
          <input id="timezone" style={input} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
        </div>

        <div style={{ ...fieldRow, borderTop: '1px solid var(--color-border, #E2E8F0)', paddingTop: '1rem' }}>
          <label style={label}>Issued integration credentials {config?.hasCredentials && <span style={{ color: 'var(--color-success, #047857)', fontWeight: 600 }}>· stored</span>}</label>
          <div style={hint}>Store only credentials HHAeXchange issued after vendor onboarding/testing. Pennsylvania V5 commonly uses an SFTP account.</div>
          <div style={{ marginTop: '0.6rem' }}>
            <input style={input} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key (optional)" autoComplete="off" type="password" />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem' }}>
            <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="off" />
            <input style={input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="off" type="password" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--color-text, #0F172A)', cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary, #107480)' }} />
          Enable HHAeXchange submission for this agency
        </label>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</button>
        </div>
        {saveMsg && banner(saveMsg.tone, saveMsg.text)}
      </form>

      <form style={card} onSubmit={onSubmitBatch}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--color-text, #0F172A)' }}>Submit a batch</h3>
        <p style={{ ...hint, marginTop: 0, marginBottom: '1rem' }}>Production submission remains disabled until the official PA V5 mapping and HHAeXchange-issued SFTP onboarding artifacts are installed and validated. The current CSV is a mapping preview only.</p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={label} htmlFor="from">From</label>
            <input id="from" type="date" style={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={label} htmlFor="to">To</label>
            <input id="to" type="date" style={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" style={{ ...primaryBtn, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit to HHAeXchange'}</button>
        </div>
        {submitError && banner('info', submitError)}
        {submitResult && banner('success', `Batch ${submitResult.batchId} sent — ${submitResult.accepted} accepted, ${submitResult.submitted} submitted, ${submitResult.rejected} rejected.`)}
      </form>
    </ComplianceModuleLayout>
  );
}
