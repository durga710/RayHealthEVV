import React, { useEffect, useState } from 'react';
import { getJson, postJson, putJson, ApiError } from '../../lib/api-client.js';
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
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.25rem',
  marginTop: '1rem',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.35rem' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.9rem' };
const primaryBtn: React.CSSProperties = { background: 'var(--color-primary)', border: 'none', borderRadius: 8, color: 'var(--color-surface)', cursor: 'pointer', fontWeight: 700, padding: '0.55rem 1.1rem' };
const secondaryBtn: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', cursor: 'pointer', fontWeight: 700, padding: '0.55rem 1.1rem' };
const fieldRow: React.CSSProperties = { marginBottom: '1rem' };
const hint: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' };

function banner(tone: 'error' | 'success' | 'warning', text: string) {
  const palette = {
    error: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger-text)' },
    success: { bg: 'var(--color-success-bg)', fg: 'var(--color-success-text)' },
    warning: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' },
  }[tone];
  return <div style={{ background: palette.bg, color: palette.fg, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.85rem', marginTop: '0.75rem' }}>{text}</div>;
}

function settingString(settings: Record<string, unknown>, key: string): string {
  const v = settings?.[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

export function ClearinghouseConfigPage() {
  const [config, setConfig] = useState<ClearinghouseConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [transport, setTransport] = useState('sftp');
  const [endpoint, setEndpoint] = useState('');
  const [submitterId, setSubmitterId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [port, setPort] = useState('');
  const [uploadDir, setUploadDir] = useState('');
  const [remittanceDir, setRemittanceDir] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const isSandbox = transport === 'sandbox';

  const applyConfig = (c: ClearinghouseConfig) => {
    setConfig(c);
    setTransport(c.transport || 'sftp');
    setEndpoint(c.endpoint ?? '');
    setSubmitterId(settingString(c.settings, 'submitterId'));
    setReceiverId(settingString(c.settings, 'receiverId'));
    setPort(settingString(c.settings, 'port'));
    setUploadDir(settingString(c.settings, 'uploadDir'));
    setRemittanceDir(settingString(c.settings, 'remittanceDir'));
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
      const settings: Record<string, unknown> = { submitterId: submitterId.trim(), receiverId: receiverId.trim() };
      if (transport === 'sftp') {
        if (port.trim()) settings.port = Number(port.trim());
        if (uploadDir.trim()) settings.uploadDir = uploadDir.trim();
        if (remittanceDir.trim()) settings.remittanceDir = remittanceDir.trim();
      }
      const body: Record<string, unknown> = {
        transport,
        endpoint: isSandbox ? null : endpoint.trim() || null,
        settings,
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

  const onTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await postJson<{ success: boolean; data: { ok: boolean; detail: string } }>(
        '/api/agencies/me/clearinghouse-config/test',
        {},
      );
      setTestMsg({ tone: r.data.ok ? 'success' : 'error', text: r.data.detail });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Connection test failed';
      setTestMsg({ tone: 'error', text: msg });
    } finally {
      setTesting(false);
    }
  };

  const kpis: KpiTile[] = [
    { label: 'Transport', value: config ? (config.transport || 'sftp').toUpperCase() : '-', tone: config?.transport === 'sandbox' ? 'warning' : 'neutral' },
    { label: 'Endpoint', value: config?.transport === 'sandbox' ? 'Simulator' : config?.endpoint ? 'Set' : 'Missing', tone: config?.transport === 'sandbox' || config?.endpoint ? 'success' : 'warning' },
    { label: 'Credentials', value: config?.transport === 'sandbox' ? 'Not needed' : config?.hasCredentials ? 'Stored' : 'Missing', tone: config?.transport === 'sandbox' || config?.hasCredentials ? 'success' : 'warning' },
    { label: 'Status', value: config?.enabled ? 'Enabled' : 'Disabled', tone: config?.enabled ? 'success' : 'neutral' },
  ];

  return (
    <ComplianceModuleLayout
      title="Claim Clearinghouse"
      tagline="Configure the agency's 837/835 clearinghouse connection. Claims submit automatically from the Claims page and 835 remittances are pulled in on a schedule."
      status="live"
      kpis={kpis}
      dataSources={['agency_clearinghouse_config', 'clearinghouse_remittance_files']}
      nextSteps={[
        'Pick a transport: SFTP or HTTPS for a real clearinghouse account, or Sandbox to demo the full loop with simulated payments.',
        'Save, then use Test connection to verify reachability before enabling automated submission.',
        'Submit ready claims from the Claims page; ingested remittances appear on the Remittance page automatically.',
      ]}
      related={[{ label: 'Claims', to: '/admin/compliance-engine/claims' }, { label: 'Remittance (ERA)', to: '/admin/compliance-engine/remittances' }]}
    >
      {loadError && banner('error', loadError)}

      <form style={card} onSubmit={onSave}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', color: 'var(--color-text)' }}>Configuration</h3>
        <p style={{ ...hint, marginTop: 0, marginBottom: '1rem' }}>Credentials are encrypted at rest and never displayed. Leave the credential fields blank to keep the stored values.</p>

        <div style={fieldRow}>
          <label style={label} htmlFor="transport">Transport</label>
          <select id="transport" style={input} value={transport} onChange={(e) => setTransport(e.target.value)}>
            <option value="sftp">SFTP</option>
            <option value="http">HTTPS API</option>
            <option value="sandbox">Sandbox simulator</option>
          </select>
        </div>

        {isSandbox &&
          banner(
            'warning',
            'Sandbox is a built-in simulator. Claims are not sent to any real clearinghouse, and remittances are generated automatically for demo and testing. Switch to SFTP or HTTPS with real credentials before production billing.',
          )}

        {!isSandbox && (
          <>
            <div style={fieldRow}>
              <label style={label} htmlFor="endpoint">Endpoint</label>
              <input id="endpoint" style={input} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder={transport === 'sftp' ? 'sftp.clearinghouse.example' : 'https://api.clearinghouse.example'} />
              {transport === 'sftp' && <div style={hint}>Bare hostname only, no sftp:// prefix.</div>}
            </div>
            {transport === 'sftp' && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ ...fieldRow, width: 110 }}>
                  <label style={label} htmlFor="port">Port</label>
                  <input id="port" style={input} value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" inputMode="numeric" />
                </div>
                <div style={{ ...fieldRow, flex: 1 }}>
                  <label style={label} htmlFor="uploadDir">Upload directory (837)</label>
                  <input id="uploadDir" style={input} value={uploadDir} onChange={(e) => setUploadDir(e.target.value)} placeholder="/inbound" />
                </div>
                <div style={{ ...fieldRow, flex: 1 }}>
                  <label style={label} htmlFor="remittanceDir">Remittance directory (835)</label>
                  <input id="remittanceDir" style={input} value={remittanceDir} onChange={(e) => setRemittanceDir(e.target.value)} placeholder="/outbound" />
                </div>
              </div>
            )}
          </>
        )}

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

        {!isSandbox && (
          <div style={{ ...fieldRow, borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <label style={label}>Credentials {config?.hasCredentials && <span style={{ color: 'var(--color-success-text)', fontWeight: 600 }}>· stored</span>}</label>
            <div style={hint}>An API key, or the SFTP username + password.</div>
            <div style={{ marginTop: '0.6rem' }}>
              <input style={input} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key (optional)" autoComplete="off" type="password" />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem' }}>
              <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="off" />
              <input style={input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="off" type="password" />
            </div>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--color-text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
          Enable clearinghouse connection for this agency
        </label>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button type="submit" style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</button>
          <button type="button" style={{ ...secondaryBtn, opacity: testing ? 0.7 : 1 }} disabled={testing} onClick={onTest}>{testing ? 'Testing…' : 'Test connection'}</button>
        </div>
        {saveMsg && banner(saveMsg.tone, saveMsg.text)}
        {testMsg && banner(testMsg.tone, testMsg.text)}
      </form>
    </ComplianceModuleLayout>
  );
}
