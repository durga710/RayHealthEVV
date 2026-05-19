import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface Client { id: string; firstName: string; lastName: string; }

interface Authorization {
  id: string;
  clientId: string;
  payerId: string;
  serviceCode: string;
  unitsAuthorized: number;
  startDate: string;
  endDate: string;
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

const PA_SERVICE_CODES = [
  { code: 'W1793', label: 'W1793 — Personal Assistance' },
  { code: 'W7076', label: 'W7076 — Attendant Care' },
  { code: 'W8001', label: 'W8001 — Respite Care' },
  { code: 'S5125', label: 'S5125 — Home Health Aide' },
  { code: 'T1019', label: 'T1019 — Personal Care Aide' },
];

const selectStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  border: '1px solid #c9d8e8',
  borderRadius: '8px',
  fontFamily: 'inherit',
  fontSize: '1rem',
  color: 'var(--color-text)',
  backgroundColor: 'white',
  width: '100%',
};

export function AuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [unitsAuthorized, setUnitsAuthorized] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getJson<Authorization[]>('/api/authorizations'),
      getJson<Client[]>('/api/clients'),
    ])
      .then(([auths, cls]) => {
        setAuthorizations(auths || []);
        setClients(cls || []);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const clientName = (id: string) => {
    const c = clients.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id.slice(0, 8) + '…';
  };

  const focusAdd = () => document.getElementById('authClientId')?.focus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setBanner(null);
    const effectiveCode = serviceCode === 'OTHER' ? customCode : serviceCode;
    if (!effectiveCode) { setValidationError('Please enter a service code.'); return; }
    if (startDate && endDate && endDate < startDate) {
      setValidationError('End date must be on or after start date.');
      return;
    }
    setSubmitting(true);
    try {
      const newAuth = await postJson<Authorization>('/api/authorizations', {
        clientId,
        payerId,
        serviceCode: effectiveCode,
        unitsAuthorized: Number(unitsAuthorized),
        startDate,
        endDate,
      });
      setAuthorizations(prev => [...prev, newAuth]);
      setClientId(''); setPayerId(''); setServiceCode(''); setCustomCode('');
      setUnitsAuthorized(''); setStartDate(''); setEndDate('');
      setBanner({ kind: 'success', text: `Authorization added for ${clientName(newAuth.clientId)}.` });
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to add authorization.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>PA Authorizations</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Manage service authorizations and unit tracking.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: '1rem' }}>Add Authorization</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label htmlFor="authClientId">Client</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <select id="authClientId" value={clientId} onChange={e => setClientId(e.target.value)} required style={selectStyle}>
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="payerId">Payer ID</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <input id="payerId" value={payerId} onChange={e => setPayerId(e.target.value)} placeholder="e.g. PA-MA-12" required />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="serviceCode">Service Code</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <select id="serviceCode" value={serviceCode} onChange={e => { setServiceCode(e.target.value); setCustomCode(''); }} required style={selectStyle}>
                  <option value="">Select…</option>
                  {PA_SERVICE_CODES.map(s => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                  <option value="OTHER">Other…</option>
                </select>
                {serviceCode === 'OTHER' && (
                  <input
                    placeholder="Enter service code"
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value)}
                    style={{ marginTop: '0.5rem' }}
                    required
                  />
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="units">Units</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="units" type="number" min="1" value={unitsAuthorized} onChange={e => setUnitsAuthorized(Number(e.target.value))} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="startDate">Start Date</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="startDate" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setValidationError(''); }} required />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label htmlFor="endDate">End Date</label>
                  <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
                </div>
                <input id="endDate" type="date" value={endDate} min={startDate || undefined} onChange={e => { setEndDate(e.target.value); setValidationError(''); }} required />
              </div>
            </div>

            {validationError && (
              <div role="alert" style={{ marginTop: '0.5rem', color: '#991b1b', fontSize: '0.875rem', fontWeight: 600 }}>
                {validationError}
              </div>
            )}

            <button type="submit" disabled={submitting} style={submitting ? { opacity: 0.6, cursor: 'wait' } : undefined}>
              {submitting ? 'Saving…' : 'Save Authorization'}
            </button>
          </form>
          {banner && (
            <div
              role={banner.kind === 'error' ? 'alert' : 'status'}
              style={{
                marginTop: '1rem', padding: '1rem', borderRadius: '8px', fontWeight: 600,
                backgroundColor: banner.kind === 'success' ? '#ecfdf5' : '#fef2f2',
                color: banner.kind === 'success' ? '#065f46' : '#991b1b',
              }}
            >
              {banner.text}
            </div>
          )}
        </div>

        <div>
          <h3>Active Authorizations</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadData} />
          ) : authorizations.length === 0 ? (
            <EmptyState
              title="No authorizations yet"
              body="Add a PA authorization to track service units and effective dates."
              cta={{ label: 'Add an authorization', onClick: focusAdd }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {authorizations.map(a => {
                const isExpanded = expandedId === a.id;
                const today = new Date().toISOString().slice(0, 10);
                const isExpired = a.endDate < today;
                const isExpiringSoon = !isExpired && a.endDate <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
                return (
                  <li key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: isExpanded ? '#f8fafc' : 'white' }}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                    >
                      <div>
                        <strong>{a.serviceCode}</strong> — {clientName(a.clientId)}
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {a.unitsAuthorized} units · {a.startDate} → {a.endDate}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {isExpired && (
                          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 700 }}>EXPIRED</span>
                        )}
                        {isExpiringSoon && (
                          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 700 }}>EXPIRING SOON</span>
                        )}
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{isExpanded ? '▾' : '▸'}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', color: '#475569' }}>
                        <div style={{ fontWeight: 600 }}>Authorization ID</div><div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.id}</div>
                        <div style={{ fontWeight: 600 }}>Client</div><div>{clientName(a.clientId)}</div>
                        <div style={{ fontWeight: 600 }}>Payer ID</div><div>{a.payerId}</div>
                        <div style={{ fontWeight: 600 }}>Service code</div><div>{a.serviceCode}</div>
                        <div style={{ fontWeight: 600 }}>Units authorized</div><div>{a.unitsAuthorized}</div>
                        <div style={{ fontWeight: 600 }}>Effective</div><div>{a.startDate} → {a.endDate}</div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
