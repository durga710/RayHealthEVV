import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson, putJson, deleteJson, ApiError } from '../../lib/api-client.js';
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

// The POST /api/assignments route returns the created assignment plus any
// soft scheduling warnings (no covering authorization, units exhausted,
// non-active caregiver credentials). The UI must surface these, not drop them.
interface AssignmentCreated extends Assignment {
  warnings?: string[];
}

type Banner = { kind: 'success' | 'warning' | 'error'; text: string; details?: string[] } | null;

// Select fields use the global .select-field class for consistency.

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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
    return t ? `${t.name}, ${clientName(t.clientId)}` : id.slice(0, 8) + '…';
  };

  const caregivers = staff.filter(s => s.role === 'caregiver' || s.role === 'coordinator');

  const focusAdd = () => document.getElementById('assignClientId')?.focus();

  const resetForm = () => {
    setClientId('');
    setCaregiverId('');
    setVisitTemplateId('');
    setVisitDate('');
  };

  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setBanner(null);
    setConfirmDeleteId(null);
    setClientId(a.clientId);
    setCaregiverId(a.caregiverId);
    setVisitTemplateId(a.visitTemplateId);
    setVisitDate(a.visitDate ?? '');
    document.getElementById('assignClientId')?.focus();
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
    setBanner(null);
  };

  const handleDelete = async (a: Assignment) => {
    setRowError(null);
    try {
      await deleteJson(`/api/assignments/${a.id}`);
      setAssignments(prev => prev.filter(x => x.id !== a.id));
      setConfirmDeleteId(null);
      setExpandedId(null);
      if (editingId === a.id) cancelEdit();
      setBanner({ kind: 'success', text: `Assignment removed for ${clientName(a.clientId)}.` });
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : (err as Error).message || 'Failed to delete assignment.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      if (editingId) {
        // Reschedule / reassign. The client is derived from the template, so we
        // send caregiver, template, and date, the server re-validates tenancy.
        const { warnings, ...updated } = await putJson<AssignmentCreated>(`/api/assignments/${editingId}`, {
          caregiverId,
          visitTemplateId,
          visitDate: visitDate || null,
        });
        setAssignments(prev => prev.map(a => (a.id === editingId ? { ...a, ...updated } : a)));
        setEditingId(null);
        resetForm();
        const updatedSummary = `Assignment updated for ${caregiverLabel(updated.caregiverId)} → ${clientName(updated.clientId ?? clientId)}.`;
        setBanner(
          warnings && warnings.length > 0
            ? { kind: 'warning', text: `${updatedSummary} Review these before the visit:`, details: warnings }
            : { kind: 'success', text: updatedSummary },
        );
      } else {
        const newAssign = await postJson<AssignmentCreated>('/api/assignments', {
          clientId,
          caregiverId,
          visitTemplateId,
          visitDate: visitDate || undefined,
        });
        const { warnings, ...assignment } = newAssign;
        setAssignments(prev => [...prev, assignment]);
        resetForm();
        const summary = `Assignment created for ${caregiverLabel(assignment.caregiverId)} → ${clientName(assignment.clientId)}.`;
        setBanner(
          warnings && warnings.length > 0
            ? { kind: 'warning', text: `${summary} Review these before the visit:`, details: warnings }
            : { kind: 'success', text: summary },
        );
      }
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to save assignment.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Assignments</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Schedule and assign caregivers to client visits.
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="form-card">
          <h3 className="section-title" style={{ margin: 0, marginBottom: '1.25rem' }}>{editingId ? 'Edit assignment' : 'New assignment'}</h3>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="assignClientId" className="label">Client</label>
                <select id="assignClientId" value={clientId} onChange={e => setClientId(e.target.value)} required className="select-field">
                  <option value="">Select a client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="assignCaregiverId" className="label">Caregiver</label>
                <select id="assignCaregiverId" value={caregiverId} onChange={e => setCaregiverId(e.target.value)} required className="select-field">
                  <option value="">Select a caregiver…</option>
                  {caregivers.map(s => (
                    <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="assignTemplateId" className="label">Visit Template</label>
                <select id="assignTemplateId" value={visitTemplateId} onChange={e => setVisitTemplateId(e.target.value)} required className="select-field">
                  <option value="">Select a template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}, {clientName(t.clientId)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="visitDate" className="label">Visit Date <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span></label>
                <input id="visitDate" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="input-field" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1.25rem' }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create Assignment'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn-ghost btn-sm">Cancel</button>
              )}
            </div>
          </form>
          {banner && (
            <div
              role={banner.kind === 'error' ? 'alert' : 'status'}
              className={`info-banner ${
                banner.kind === 'success'
                  ? 'banner-success'
                  : banner.kind === 'warning'
                    ? 'banner-warning'
                    : 'banner-error'
              }`}
              style={{ marginTop: '1rem' }}
            >
              {banner.text}
              {banner.details && banner.details.length > 0 && (
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                  {banner.details.map((d, i) => (
                    <li key={i} style={{ marginTop: i === 0 ? 0 : '0.2rem' }}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Upcoming assignments</h3>
            {!loading && !loadError && assignments.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{assignments.length} total</span>
            )}
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} columns={4} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadAll} />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              body="Schedule a caregiver against a visit template to populate this list."
              cta={{ label: 'Add an assignment', onClick: focusAdd }}
            />
          ) : (
            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Caregiver</th>
                  <th>Client</th>
                  <th>Template</th>
                  <th>Visit date</th>
                  <th style={{ width: '40px' }} aria-label="expand" />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const isExpanded = expandedId === a.id;
                  return (
                    <React.Fragment key={a.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        style={{ cursor: 'pointer' }}
                        aria-expanded={isExpanded}
                      >
                        <td style={{ fontWeight: 500 }}>{caregiverLabel(a.caregiverId)}</td>
                        <td style={{ color: '#475569' }}>{clientName(a.clientId)}</td>
                        <td style={{ color: '#475569', fontSize: '0.8125rem' }}>{templateLabel(a.visitTemplateId)}</td>
                        <td>
                          {a.visitDate ? (
                            <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>{a.visitDate}</span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>, </span>
                          )}
                        </td>
                        <td style={{ color: '#94A3B8' }}>{isExpanded ? '▾' : '▸'}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.25rem', fontSize: '0.8125rem', color: '#475569' }}>
                              <div style={{ fontWeight: 600 }}>Assignment ID</div>
                              <div style={{ fontFamily: 'var(--font-mono)' }}>{a.id}</div>
                              <div style={{ fontWeight: 600 }}>Caregiver</div>
                              <div>{caregiverLabel(a.caregiverId)}</div>
                              <div style={{ fontWeight: 600 }}>Client</div>
                              <div>{clientName(a.clientId)}</div>
                              <div style={{ fontWeight: 600 }}>Template</div>
                              <div>{templateLabel(a.visitTemplateId)}</div>
                              <div style={{ fontWeight: 600 }}>Visit date</div>
                              <div>{a.visitDate || <em style={{ color: '#94A3B8' }}>not set</em>}</div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
                              {confirmDeleteId === a.id ? (
                                <>
                                  <span style={{ fontSize: '0.8125rem', color: '#BE123C', fontWeight: 600 }}>Delete this assignment?</span>
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
