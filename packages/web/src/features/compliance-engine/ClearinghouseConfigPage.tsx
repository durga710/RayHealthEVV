import React, { useEffect, useState } from 'react';
import { getJson, putJson, ApiError } from '../../lib/api-client.js';
import { ComplianceModuleLayout, type KpiTile } from './ComplianceModuleLayout.js';

interface ClearinghouseConfig {
  agencyId: string;
  transport: string;
  endpoint: string | null;
  settings: Record<string, unknown>;
  enabled: boolean;
  hasCredentials: boolean;
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

function banner(tone: 'error' | 'success', text: string) {
  const palette = {
    error: { bg: 'var(--color-accent-bg, #FEF2F2)', fg: 'var(--color-accent, #B91C1C)' },
    success: { bg: 'var(--color-success-bg, #ECFDF5)', fg: 'var(--color-success, #047857)' },
  }[tone];
  return <div style={{ background: palette.bg, color: palette.fg, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.85rem', marginTop: '0.75rem' }}>{text}</div>;
}

function settingString(settings: Record<string, unknown>, key: string): string {
  const v = settings?.[key];
  return typeof v === 'string' ? v : '';
}

export function ClearinghouseConfigPage() {
  const [config, setConfig] = useState<ClearinghouseConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [transport, setTransport] = useState('sftp');
  const [endpoint, setEndpoint] = useState('');
  const [submitterId, setSubmitterId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const applyConfig = (c: ClearinghouseConfig) => {
    setConfig(c);
    setTransport(c.transport || 'sftp');
    setEndpoint(c.endpoint ?? '');
    setSubmitterId(settingString(c.settings, 'submitterId'));
    setReceiverId(settingString(c.settings, 'receiverId'));
    setEnabled(c.enabled);
  };

  useEffect(() => {
    getJson<{ success: boolean; data: ClearinghouseConfig }>('/api/agencies/me/clearinghouse-config')
      .then((r) => applyConfig(r.data))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load clearinghouse config'));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        transport,
        endpoint: endpoint.trim() || null,
        settings: { submitterId: submitterId.trim(), receiverId: receiverId.trim() },
        enabled,
      };
      const creds: Record<string, string> = {};
      if (apiKey.trim()) creds.apiKey = apiKey.trim();
      if (username.trim()) creds.username = username.trim();
      if (password) creds.password = password;
      if (Object.keys(creds).length > 0) body.credentials = creds;

      const r = await putJson<{ success: boolean; data: ClearinghouseConfig }>('/api/agencies/me/clearinghouse-config', body);
      applyConfig(r.data);
      setApiKey('');
      setUsername('');
      setPassword('');
      setSaveMsg({ tone: 'success', text: 'Clearinghouse configuration saved.' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Save failed';
      setSaveMsg({ tone: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const kpis: KpiTile[] = [
    { label: 'Transport', value: config ? (config.transport || 'sftp').toUpperCase() : ', ', tone: 'neutral' },
    { label: 'Endpoint', value: config?.endpoint ? 'Set' : 'Missing', tone: config?.endpoint ? 'success' : 'warning' },
    { label: 'Credentials', value: config?.hasCredentials ? 'Stored' : 'Missing', tone: config?.hasCredentials ? 'success' : 'warning' },
    { label: 'Status', value: config?.enabled ? 'Enabled' : 'Disabled', tone: config?.enabled ? 'success' : 'neutral' },
  ];

  return (
    <ComplianceModuleLayout
      title="Claim Clearinghouse"
      tagline="Store the agency's 837/835 clearinghouse trading-partner connection. Automated 837 transmission and 835 retrieval are not yet implemented."
      status="scaffold"
      kpis={kpis}
      dataSources={['agency_clearinghouse_config']}
      nextSteps={[
        'Enter the clearinghouse transport, endpoint, submitter/receiver IDs, and credentials, then enable the connection.',
        'Until automated transmission ships, download the 837 from Claims and upload it to your clearinghouse portal; post returned 835s on the Remittance page.',
      ]}
      related={[{ label: 'Claims', to: '/admin/compliance-engine/claims' }, { label: 'Remittance (ERA)', to: '/admin/compliance-engine/remittances' }]}
    >
      {loadError && banner('error', loadError)}

      <form style={card} onSubmit={onSave}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--color-text, #0F172A)' }}>Configuration</h3>
        <p style={{ ...hint, marginTop: 0, marginBottom: '1rem' }}>Credentials are encrypted at rest and never displayed. Leave the credential fields blank to keep the stored values.</p>

        <div style={fieldRow}>
          <label style={label} htmlFor="transport">Transport</label>
          <select id="transport" style={input} value={transport} onChange={(e) => setTransport(e.target.value)}>
            <option value="sftp">SFTP</option>
            <option value="http">HTTPS API</option>
          </select>
        </div>
        <div style={fieldRow}>
          <label style={label} htmlFor="endpoint">Endpoint</label>
          <input id="endpoint" style={input} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder={transport === 'sftp' ? 'sftp.clearinghouse.example' : 'https://api.clearinghouse.example'} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...fieldRow, flex: 1 }}>
            <label style={label} htmlFor="submitterId">Submitter ID</label>
            <input id="submitterId" style={input} value={submitterId} onChange={(e) => setSubmitterId(e.target.value)} placeholder="ISA06 / submitter" />
          </div>
          <div style={{ ...fieldRow, flex: 1 }}>
            <label style={label} htmlFor="receiverId">Receiver ID</label>
            <input id="receiverId" style={input} value={receiverId} onChange={(e) => setReceiverId(e.target.value)} placeholder="ISA08 / receiver" />
          </div>
        </div>

        <div style={{ ...fieldRow, borderTop: '1px solid var(--color-border, #E2E8F0)', paddingTop: '1rem' }}>
          <label style={label}>Credentials {config?.hasCredentials && <span style={{ color: 'var(--color-success, #047857)', fontWeight: 600 }}>· stored</span>}</label>
          <div style={hint}>An API key, or the SFTP username + password.</div>
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
          Enable clearinghouse connection for this agency
        </label>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</button>
        </div>
        {saveMsg && banner(saveMsg.tone, saveMsg.text)}
      </form>
    </ComplianceModuleLayout>
  );
}
