import React, { useEffect, useState } from 'react';
import { getJson, putJson, postJson, ApiError } from '../../lib/api-client.js';
import { ComplianceModuleLayout, type KpiTile } from './ComplianceModuleLayout.js';

interface SandataConfig {
  agencyId: string;
  providerId: string | null;
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

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 700,
  color: 'var(--color-text, #0F172A)',
  marginBottom: '0.35rem',
};

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.55rem 0.7rem',
  border: '1px solid var(--color-border, #E2E8F0)',
  borderRadius: 8,
  fontSize: '0.9rem',
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--color-primary, #107480)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  padding: '0.55rem 1.1rem',
};

const fieldRow: React.CSSProperties = { marginBottom: '1rem' };
const hint: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--color-text-muted, #64748B)', marginTop: '0.3rem' };

function banner(tone: 'error' | 'success' | 'info', text: string) {
  const palette = {
    error: { bg: 'var(--color-accent-bg, #FEF2F2)', fg: 'var(--color-accent, #B91C1C)' },
    success: { bg: 'var(--color-success-bg, #ECFDF5)', fg: 'var(--color-success, #047857)' },
    info: { bg: 'var(--color-primary-bg, #ECFEFF)', fg: 'var(--color-primary-dark, #0E7490)' },
  }[tone];
  return (
    <div style={{ background: palette.bg, color: palette.fg, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.85rem', marginTop: '0.75rem' }}>
      {text}
    </div>
  );
}

export function EvvSubmissionPage() {
  const [config, setConfig] = useState<SandataConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Config form state.
  const [providerId, setProviderId] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  // Submit-batch state.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitOk | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const applyConfig = (c: SandataConfig) => {
    setConfig(c);
    setProviderId(c.providerId ?? '');
    setApiBaseUrl(c.apiBaseUrl ?? '');
    setTimezone(c.timezone || 'America/New_York');
    setEnabled(c.enabled);
  };

  useEffect(() => {
    getJson<{ success: boolean; data: SandataConfig }>('/api/agencies/me/sandata-config')
      .then((r) => applyConfig(r.data))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load Sandata config'));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        providerId: providerId.trim() || null,
        apiBaseUrl: apiBaseUrl.trim() || null,
        timezone,
        enabled,
      };
      // Credentials are write-only: only send the ones the admin actually typed.
      const creds: Record<string, string> = {};
      if (apiKey.trim()) creds.apiKey = apiKey.trim();
      if (username.trim()) creds.username = username.trim();
      if (password) creds.password = password;
      if (Object.keys(creds).length > 0) body.credentials = creds;

      const r = await putJson<{ success: boolean; data: SandataConfig }>('/api/agencies/me/sandata-config', body);
      applyConfig(r.data);
      setApiKey('');
      setUsername('');
      setPassword('');
      setSaveMsg({ tone: 'success', text: 'Sandata configuration saved.' });
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
      const r = await postJson<SubmitOk>('/api/exports/sandata/submit', {
        from: from || undefined,
        to: to || undefined,
      });
      setSubmitResult(r);
    } catch (err) {
      if (err instanceof ApiError) {
        const b = (err.body ?? {}) as { status?: string; reason?: string; message?: string };
        if (b.status === 'not_configured') {
          setSubmitError(`Not configured: ${b.reason ?? 'finish the configuration above and enable the integration.'}`);
        } else if (b.status === 'error') {
          setSubmitError(`Submission failed: ${b.message ?? err.message}`);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const kpis: KpiTile[] = [
    { label: 'Provider ID', value: config?.providerId ? 'Set' : 'Missing', tone: config?.providerId ? 'success' : 'warning' },
    { label: 'Credentials', value: config?.hasCredentials ? 'Stored' : 'Missing', tone: config?.hasCredentials ? 'success' : 'warning' },
    { label: 'Endpoint', value: config?.apiBaseUrl ? 'Set' : 'Missing', tone: config?.apiBaseUrl ? 'success' : 'warning' },
    { label: 'Status', value: config?.enabled ? 'Enabled' : 'Disabled', tone: config?.enabled ? 'success' : 'neutral' },
  ];

  const mappingCount = (config?.caregivers.length ?? 0) + (config?.services.length ?? 0);

  return (
    <ComplianceModuleLayout
      title="EVV Submission. Sandata"
      tagline="Configure the agency's Sandata Alternate-EVV connection and transmit verified visits to the state aggregator."
      status="beta"
      kpis={kpis}
      dataSources={['agency_sandata_config', 'evv_visits']}
      nextSteps={[
        'Enter the Sandata Provider ID, API base URL, and API credentials issued for this agency, then enable the integration.',
        'Map each caregiver to a Sandata worker ID and each service code to its HCPCS code (managed via Data Import / API).',
        'Submit a date range; each visit is sent to Sandata and its acknowledgment recorded.',
      ]}
      related={[{ label: 'Remittance (ERA)', to: '/admin/compliance-engine/remittances' }, { label: 'Claims', to: '/admin/compliance-engine/claims' }]}
    >
      {loadError && banner('error', loadError)}

      {/* ─── Configuration ─────────────────────────────────────────────── */}
      <form style={card} onSubmit={onSave}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--color-text, #0F172A)' }}>Configuration</h3>
        <p style={{ ...hint, marginTop: 0, marginBottom: '1rem' }}>
          Credentials are encrypted at rest and never displayed. Leave the credential fields blank to keep the stored values.
        </p>

        <div style={fieldRow}>
          <label style={label} htmlFor="providerId">Sandata Provider ID</label>
          <input id="providerId" style={input} value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="9-digit Provider ID" inputMode="numeric" />
          <div style={hint}>Issued by Sandata when the agency registers (9 digits).</div>
        </div>

        <div style={fieldRow}>
          <label style={label} htmlFor="apiBaseUrl">API base URL</label>
          <input id="apiBaseUrl" style={input} value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://uat-api.sandata.com/interface/v3" />
          <div style={hint}>The state- and environment-specific Sandata endpoint (sandbox vs production).</div>
        </div>

        <div style={fieldRow}>
          <label style={label} htmlFor="timezone">Timezone</label>
          <input id="timezone" style={input} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
        </div>

        <div style={{ ...fieldRow, borderTop: '1px solid var(--color-border, #E2E8F0)', paddingTop: '1rem' }}>
          <label style={label}>API credentials {config?.hasCredentials && <span style={{ color: 'var(--color-success, #047857)', fontWeight: 600 }}>· stored</span>}</label>
          <div style={hint}>Provide either an API key, or a username + password, whichever Sandata issued for this agency.</div>
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
          Enable automated Sandata submission for this agency
        </label>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? 'Saving…' : 'Save configuration'}
          </button>
        </div>
        {saveMsg && banner(saveMsg.tone, saveMsg.text)}
        {mappingCount === 0 && banner('info', 'No caregiver/service mappings configured yet. Visits without a Sandata worker + HCPCS mapping are reported as rejected until mapped.')}
      </form>

      {/* ─── Submit a batch ────────────────────────────────────────────── */}
      <form style={card} onSubmit={onSubmitBatch}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--color-text, #0F172A)' }}>Submit a batch</h3>
        <p style={{ ...hint, marginTop: 0, marginBottom: '1rem' }}>
          Transmits every <strong>verified</strong> visit in the date range to Sandata and records each acknowledgment. Leave dates blank to include all verified visits.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={label} htmlFor="from">From</label>
            <input id="from" type="date" style={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={label} htmlFor="to">To</label>
            <input id="to" type="date" style={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" style={{ ...primaryBtn, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit to Sandata'}
          </button>
        </div>
        {submitError && banner('error', submitError)}
        {submitResult && banner('success', `Batch ${submitResult.batchId} sent, ${submitResult.accepted} accepted, ${submitResult.submitted} submitted, ${submitResult.rejected} rejected.`)}
      </form>
    </ComplianceModuleLayout>
  );
}
