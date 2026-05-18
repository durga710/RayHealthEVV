import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface Client { id: string; firstName: string; lastName: string; }
interface StaffMember { id: string; email: string; role: string; }

interface Template {
  id: string;
  name: string;
  clientId: string;
}

interface Assignment {
  id: string;
  clientId: string;
  caregiverId: string;
  visitDate?: string;
  visitTemplateId: string;
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

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

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [caregiverId, setCaregiverId] = useState('');
  const [visitTemplateId, setVisitTemplateId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getJson<Assignment[]>('/api/assignments'),
      getJson<Template[]>('/api/templates'),
      getJson<Client[]>('/api/clients'),
      getJson<StaffMember[]>('/api/staff'),
    ])
      .then(([asgns, tmpls, cls, stf]) => {
        setAssignments(asgns || []);
        setTemplates(tmpls || []);
        setClients(cls || []);
        setStaff(stf || []);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const clientName = (id: string) => {
    const c = clients.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id.slice(0, 8) + '…';
  };

  const caregiverLabel = (id: string) => {
    const s = staff.find(x => x.id === id);
    return s ? s.email : id.slice(0, 8) + '…';
  };

  const templateLabel = (id: string) => {
    const t = templates.find(x => x.id === id);
    return t ? `${t.name} — ${clientName(t.clientId)}` : id.slice(0, 8) + '…';
  };

  const caregivers = staff.filter(s => s.role === 'caregiver' || s.role === 'coordinator');

  const focusAdd = () => document.getElementById('assignClientId')?.focus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      const newAssign = await postJson<Assignment>('/api/assignments', {
        clientId,
        caregiverId,
        visitTemplateId,
        visitDate: visitDate || undefined,
      });
      setAssignments(prev => [...prev, newAssign]);
      setClientId('');
      setCaregiverId('');
      setVisitTemplateId('');
      setVisitDate('');
      setBanner({ kind: 'success', text: `Assignment created for ${caregiverLabel(newAssign.caregiverId)} → ${clientName(newAssign.clientId)}.` });
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to create assignment.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Caregiver Assignments</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Schedule and assign caregivers to client visits.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: '1rem' }}>New Assignment</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label htmlFor="assignClientId">Client</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <select id="assignClientId" value={clientId} onChange={e => setClientId(e.target.value)} required style={selectStyle}>
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="assignCaregiverId">Caregiver</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <select id="assignCaregiverId" value={caregiverId} onChange={e => setCaregiverId(e.target.value)} required style={selectStyle}>
                <option value="">Select a caregiver…</option>
                {caregivers.map(s => (
                  <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="assignTemplateId">Visit Template</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <select id="assignTemplateId" value={visitTemplateId} onChange={e => setVisitTemplateId(e.target.value)} required style={selectStyle}>
                <option value="">Select a template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {clientName(t.clientId)}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="visitDate">Visit Date <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}>(optional)</span></label>
              <input id="visitDate" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>

            <button type="submit" disabled={submitting} style={submitting ? { opacity: 0.6, cursor: 'wait' } : undefined}>
              {submitting ? 'Saving…' : 'Create Assignment'}
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
          <h3>Upcoming Assignments</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadAll} />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              body="Schedule a caregiver against a visit template to populate this list."
              cta={{ label: 'Add an assignment', onClick: focusAdd }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assignments.map(a => {
                const isExpanded = expandedId === a.id;
                return (
                  <li
                    key={a.id}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: isExpanded ? '#f8fafc' : 'white' }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                    >
                      <div>
                        <strong>{caregiverLabel(a.caregiverId)}</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          Client: {clientName(a.clientId)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {a.visitDate && (
                          <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#f0fdf4', color: '#047857', borderRadius: '4px', fontWeight: 600 }}>
                            {a.visitDate}
                          </span>
                        )}
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{isExpanded ? '▾' : '▸'}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', color: '#475569' }}>
                        <div style={{ fontWeight: 600 }}>Assignment ID</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.id}</div>
                        <div style={{ fontWeight: 600 }}>Caregiver</div>
                        <div>{caregiverLabel(a.caregiverId)}</div>
                        <div style={{ fontWeight: 600 }}>Client</div>
                        <div>{clientName(a.clientId)}</div>
                        <div style={{ fontWeight: 600 }}>Template</div>
                        <div>{templateLabel(a.visitTemplateId)}</div>
                        <div style={{ fontWeight: 600 }}>Visit date</div>
                        <div>{a.visitDate || <em style={{ color: '#94a3b8' }}>not set</em>}</div>
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
