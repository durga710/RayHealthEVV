import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

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

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [caregiverId, setCaregiverId] = useState('');
  const [visitTemplateId, setVisitTemplateId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAssignments = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<Assignment[]>('/api/assignments')
      .then(data => setAssignments(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load assignments'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAssignments();

    getJson<Template[]>('/api/templates')
      .then(data => setTemplates(data || []))
      .catch(console.error);
  }, [loadAssignments]);

  const focusAddAssignment = () => {
    document.getElementById('clientId')?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const newAssign = await postJson<Assignment>('/api/assignments', { clientId, caregiverId, visitTemplateId, visitDate });
      setAssignments(prev => [...prev, newAssign]);
      setClientId('');
      setCaregiverId('');
      setVisitTemplateId('');
      setVisitDate('');
      setMessage('Assignment created successfully');
    } catch (err) {
      setMessage('Failed to create assignment');
    }
  };

  return (
    <div>
      <h2>Caregiver Assignments</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Schedule and assign caregivers to client visits.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>New Assignment</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="clientId">Client ID</label>
              <input id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="caregiverId">Caregiver ID</label>
              <input id="caregiverId" value={caregiverId} onChange={e => setCaregiverId(e.target.value)} required />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="templateId">Visit Template</label>
              <select 
                id="templateId" 
                value={visitTemplateId} 
                onChange={e => setVisitTemplateId(e.target.value)} 
                required
                style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                <option value="">Select a template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (Client: {t.clientId.slice(0,6)}...)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="visitDate">Visit Date</label>
              <input id="visitDate" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>
            
            <button type="submit">Create Assignment</button>
          </form>
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Upcoming Assignments</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadAssignments} />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              body="Schedule a caregiver against a visit template to populate this list."
              cta={{ label: 'Add an assignment', onClick: focusAddAssignment }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assignments.map(a => {
                const isExpanded = expandedId === a.id;
                return (
                  <li
                    key={a.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: isExpanded ? '#f8fafc' : 'white'
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit'
                      }}
                    >
                      <div>
                        <strong>Caregiver: {a.caregiverId.slice(0, 6)}...</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Client: {a.clientId.slice(0, 6)}...</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {a.visitDate && (
                          <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#fef3c7', color: '#047857', borderRadius: '4px' }}>
                            Date: {a.visitDate}
                          </div>
                        )}
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem', minWidth: '1ch', textAlign: 'center' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0 1rem 1rem',
                          borderTop: '1px solid #e2e8f0',
                          fontSize: '0.85rem',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.35rem 1rem',
                          color: '#475569'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>Assignment ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.id}</div>
                        <div style={{ fontWeight: 600 }}>Caregiver ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.caregiverId}</div>
                        <div style={{ fontWeight: 600 }}>Client ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.clientId}</div>
                        <div style={{ fontWeight: 600 }}>Template ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{a.visitTemplateId}</div>
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