import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson, putJson, deleteJson, ApiError } from '../../lib/api-client.js';
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
  unitsUsed?: number;
  unitsRemaining?: number;
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

// Canonical PA HCPCS codes, these are the ONLY codes EVV visits and 837 claim
// lines carry, so authorizations must use them or claim-matching and units
// burn-down silently fail. Keep in lock-step with paServiceCodes in
// packages/core/src/config/pennsylvania.ts (the API rejects anything else).
const PA_SERVICE_CODES = [
  { code: 'T1019', label: 'T1019. Personal care services (per 15 min)' },
  { code: 'S5125', label: 'S5125. Attendant care services (per 15 min)' },
  { code: 'T1004', label: 'T1004. Qualified nursing aide services (per 15 min)' },
  { code: 'T1021', label: 'T1021. Home health aide / CNA (per visit)' },
];

// Select fields use the global .select-field class for consistency.

/** Compact units burn-down meter: "<remaining> left" + a thin usage bar.
 *  Green when comfortable, amber under 20% remaining, red when exhausted. */
function UnitsMeter({ authorized, used }: { authorized: number; used?: number }) {
  const consumed = Math.max(0, used ?? 0);
  const remaining = authorized - consumed;
  const pct = authorized > 0 ? Math.min(100, Math.round((consumed / authorized) * 100)) : 0;
  const tone = remaining <= 0 ? '#BE123C' : remaining / authorized <= 0.2 ? '#B45309' : '#107480';
  return (
    <div style={{ minWidth: '92px' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: tone }}>
        {remaining <= 0 ? 'Exhausted' : `${remaining} left`}
      </div>
      <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginBottom: '0.2rem' }}>
        {consumed} / {authorized} used
      </div>
      <div style={{ height: '4px', borderRadius: '999px', background: '#E2E8F0', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
      </div>
    </div>
  );
}

export function AuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [unitsAuthorized, setUnitsAuthorized] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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

  const resetForm = () => {
    setClientId(''); setPayerId(''); setServiceCode('');
    setUnitsAuthorized(''); setStartDate(''); setEndDate('');
  };

  const startEdit = (a: Authorization) => {
    setEditingId(a.id);
    setBanner(null);
    setValidationError('');
    setConfirmDeleteId(null);
    setClientId(a.clientId);
    setPayerId(a.payerId);
    setServiceCode(a.serviceCode);
    setUnitsAuthorized(a.unitsAuthorized);
    setStartDate(a.startDate);
    setEndDate(a.endDate);
    document.getElementById('payerId')?.focus();
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
    setBanner(null);
    setValidationError('');
  };

  const handleDelete = async (a: Authorization) => {
    setRowError(null);
    try {
      await deleteJson(`/api/authorizations/${a.id}`);
      setAuthorizations(prev => prev.filter(x => x.id !== a.id));
      setConfirmDeleteId(null);
      setExpandedId(null);
      if (editingId === a.id) cancelEdit();
      setBanner({ kind: 'success', text: `Authorization removed for ${clientName(a.clientId)}.` });
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : (err as Error).message || 'Failed to delete authorization.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setBanner(null);
    if (!serviceCode) { setValidationError('Please select a service code.'); return; }
    if (startDate && endDate && endDate < startDate) {
      setValidationError('End date must be on or after start date.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        // clientId is fixed on an existing authorization (server ignores it).
        const updated = await putJson<Authorization>(`/api/authorizations/${editingId}`, {
          payerId,
          serviceCode,
          unitsAuthorized: Number(unitsAuthorized),
          startDate,
          endDate,
        });
        setAuthorizations(prev => prev.map(a => (a.id === editingId ? updated : a)));
        setEditingId(null);
        resetForm();
        setBanner({ kind: 'success', text: `Authorization updated for ${clientName(updated.clientId)}.` });
      } else {
        const newAuth = await postJson<Authorization>('/api/authorizations', {
          clientId,
          payerId,
          serviceCode,
          unitsAuthorized: Number(unitsAuthorized),
          startDate,
          endDate,
        });
        setAuthorizations(prev => [...prev, newAuth]);
        resetForm();
        setBanner({ kind: 'success', text: `Authorization added for ${clientName(newAuth.clientId)}.` });
      }
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to save authorization.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Gradient banner header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2d52 0%, #1a5fa8 60%, #2d7dd2 100%)',
          borderRadius: '12px',
          padding: '1.75rem 2rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 4px 24px rgba(15,45,82,0.18)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Authorizations
          </h1>
          <p style={{ margin: '0.3rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
            Manage Pennsylvania service authorizations and unit tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={focusAdd}
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '8px',
            padding: '0.5rem 1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Add authorization
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        <div className="form-card" style={{ borderTop: '3px solid #1690a0' }}>
          <h3 className="section-title" style={{ margin: 0, marginBottom: '1.25rem' }}>{editingId ? 'Edit authorization' : 'Add authorization'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="authClientId" className="label">Client</label>
              <select id="authClientId" value={clientId} onChange={e => setClientId(e.target.value)} required disabled={!!editingId} className="select-field">
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
              {editingId && (
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Client can&apos;t be changed on an existing authorization.</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="payerId" className="label">Payer ID</label>
              <input id="payerId" value={payerId} onChange={e => setPayerId(e.target.value)} placeholder="e.g. PA-MA-12" required className="input-field" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="serviceCode" className="label">Service Code</label>
                <select id="serviceCode" value={serviceCode} onChange={e => setServiceCode(e.target.value)} required className="select-field">
                  <option value="">Select…</option>
                  {PA_SERVICE_CODES.map(s => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="units" className="label">Units</label>
                <input id="units" type="number" min="1" value={unitsAuthorized} onChange={e => setUnitsAuthorized(Number(e.target.value))} required className="input-field" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="startDate" className="label">Start Date</label>
                <input id="startDate" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setValidationError(''); }} required className="input-field" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="endDate" className="label">End Date</label>
                <input id="endDate" type="date" value={endDate} min={startDate || undefined} onChange={e => { setEndDate(e.target.value); setValidationError(''); }} required className="input-field" />
              </div>
            </div>

            {validationError && (
              <div role="alert" style={{ color: '#BE123C', fontSize: '0.8125rem', fontWeight: 500 }}>
                {validationError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Save Authorization'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn-ghost btn-sm">Cancel</button>
              )}
            </div>
          </form>
          {banner && (
            <div
              role={banner.kind === 'error' ? 'alert' : 'status'}
              className={`info-banner ${banner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
              style={{ marginTop: '1rem' }}
            >
              {banner.text}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#94A3B8',
              }}
            >
              Active authorizations
            </span>
            {!loading && !loadError && authorizations.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#1690a0',
                  background: 'rgba(22, 144, 160,0.1)',
                  border: '1px solid rgba(22, 144, 160,0.2)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.65rem',
                  letterSpacing: '0.04em',
                }}
              >
                {authorizations.length} total
              </span>
            )}
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} columns={4} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadData} />
          ) : authorizations.length === 0 ? (
            <EmptyState
              title="No authorizations yet"
              body="Add a PA authorization to track service units and effective dates."
              cta={{ label: 'Add an authorization', onClick: focusAdd }}
            />
          ) : (
            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Client</th>
                  <th>Units remaining</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th style={{ width: '40px' }} aria-label="expand" />
                </tr>
              </thead>
              <tbody>
                {authorizations.map((a) => {
                  const isExpanded = expandedId === a.id;
                  const today = new Date().toISOString().slice(0, 10);
                  const isExpired = a.endDate < today;
                  const isExpiringSoon = !isExpired && a.endDate <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
                  return (
                    <React.Fragment key={a.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        style={{ cursor: 'pointer' }}
                        aria-expanded={isExpanded}
                      >
                        <td>
                          <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0, textTransform: 'none' }}>{a.serviceCode}</span>
                        </td>
                        <td>{clientName(a.clientId)}</td>
                        <td><UnitsMeter authorized={a.unitsAuthorized} used={a.unitsUsed} /></td>
                        <td style={{ color: '#475569', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                          {a.startDate} → {a.endDate}
                        </td>
                        <td>
                          {isExpired ? (
                            <span className="badge badge-danger">Expired</span>
                          ) : isExpiringSoon ? (
                            <span className="badge badge-warning">Expiring soon</span>
                          ) : (
                            <span className="badge badge-success">Active</span>
                          )}
                        </td>
                        <td style={{ color: '#94A3B8' }}>{isExpanded ? '▾' : '▸'}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.25rem', fontSize: '0.8125rem', color: '#475569' }}>
                              <div style={{ fontWeight: 600 }}>Authorization ID</div><div style={{ fontFamily: 'var(--font-mono)' }}>{a.id}</div>
                              <div style={{ fontWeight: 600 }}>Client</div><div>{clientName(a.clientId)}</div>
                              <div style={{ fontWeight: 600 }}>Payer ID</div><div>{a.payerId}</div>
                              <div style={{ fontWeight: 600 }}>Service code</div><div>{a.serviceCode}</div>
                              <div style={{ fontWeight: 600 }}>Units authorized</div><div>{a.unitsAuthorized}</div>
                              <div style={{ fontWeight: 600 }}>Units used (billed)</div><div>{a.unitsUsed ?? 0}</div>
                              <div style={{ fontWeight: 600 }}>Units remaining</div>
                              <div style={{ fontWeight: 600, color: (a.unitsRemaining ?? a.unitsAuthorized) <= 0 ? '#BE123C' : '#107480' }}>
                                {a.unitsRemaining ?? a.unitsAuthorized}
                              </div>
                              <div style={{ fontWeight: 600 }}>Effective</div><div>{a.startDate} → {a.endDate}</div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
                              {confirmDeleteId === a.id ? (
                                <>
                                  <span style={{ fontSize: '0.8125rem', color: '#BE123C', fontWeight: 600 }}>Delete this authorization?</span>
                                  <button type="button" className="btn-sm" style={{ background: '#BE123C', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleDelete(a)}>Confirm delete</button>
                                  <button type="button" className="btn-ghost btn-sm" onClick={() => { setConfirmDeleteId(null); setRowError(null); }}>Cancel</button>
                                </>
                              ) : (
                                <button type="button" className="btn-ghost btn-sm" style={{ color: '#BE123C' }} onClick={() => { setConfirmDeleteId(a.id); setRowError(null); }}>Delete</button>
                              )}
                            </div>
                            {rowError && confirmDeleteId === a.id && (
                              <div role="alert" style={{ marginTop: '0.6rem', fontSize: '0.8125rem', color: '#BE123C' }}>{rowError}</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
