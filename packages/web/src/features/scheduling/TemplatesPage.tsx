import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface Template {
  id: string;
  clientId: string;
  name: string;
  tasks: string[];
}

interface PATask {
  id: string;
  duty: string;
}

interface Client { id: string; firstName: string; lastName: string; }

function taskLabel(task: unknown): string {
  if (typeof task === 'string') return task;
  if (task && typeof task === 'object') {
    const t = task as Record<string, unknown>;
    if (typeof t.duty === 'string') return t.duty;
    if (typeof t.label === 'string') return t.label;
  }
  return String(task);
}

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

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [availableTasks, setAvailableTasks] = useState<PATask[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<Template[]>('/api/templates')
      .then(data => setTemplates(data || []))
      .catch((err: Error) => setLoadError(err.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
    getJson<PATask[]>('/api/tasks')
      .then(data => setAvailableTasks(data || []))
      .catch(() => { /* non-critical */ });
    getJson<Client[]>('/api/clients')
      .then(data => setClients(data || []))
      .catch(() => { /* non-critical */ });
  }, [loadTemplates]);

  const clientName = (id: string) => {
    const c = clients.find(x => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id.slice(0, 8) + '…';
  };

  const focusAddTemplate = () => {
    document.getElementById('clientId')?.focus();
  };

  const fillSampleData = () => {
    setName('Personal care — morning');
    const sampleDuties = availableTasks.slice(0, 3).map(t => t.duty);
    if (sampleDuties.length > 0) {
      setSelectedTasks(new Set(sampleDuties));
    }
    if (!clientId) {
      setClientId('client-sample-1');
    }
  };

  const handleTaskToggle = (duty: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(duty)) {
      newSelected.delete(duty);
    } else {
      newSelected.add(duty);
    }
    setSelectedTasks(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const tasks = Array.from(selectedTasks);
      if (tasks.length === 0) {
        setMessage('Please select at least one task');
        return;
      }
      const newTemplate = await postJson<Template>('/api/templates', { clientId, name, tasks });
      setTemplates(prev => [...prev, newTemplate]);
      setClientId('');
      setName('');
      setSelectedTasks(new Set());
      setMessage('Template created successfully.');
      setMessageKind('success');
    } catch (err) {
      setMessage((err as Error).message || 'Failed to create template.');
      setMessageKind('error');
    }
  };

  return (
    <div>
      <h2>Visit Templates</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Create and manage plan-of-care visit templates.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>New Template</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button
                type="button"
                onClick={fillSampleData}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  color: 'var(--color-accent)',
                  border: '1px dashed var(--color-accent)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}
              >
                Dev · Fill with sample data
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label htmlFor="clientId">Client</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <select id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required style={selectStyle}>
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="name">Template Name</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Routine" required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                <label>Select Tasks</label>
                <span style={{ color: '#dc2626', marginLeft: '0.25rem' }} aria-hidden="true">*</span>
              </div>
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid #c9d8e8', 
                borderRadius: '8px', 
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                {availableTasks.length === 0 ? (
                  <span style={{ fontSize: '0.875rem', color: '#64748b', padding: '0.5rem' }}>Loading tasks...</span>
                ) : (
                  availableTasks.map(task => (
                    <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', textTransform: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTasks.has(task.duty)} 
                        onChange={() => handleTaskToggle(task.duty)} 
                      />
                      <span style={{ fontSize: '0.875rem' }}>{task.id} - {task.duty}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            
            <button type="submit">Create Template</button>
          </form>
          {message && (
            <div
              role={messageKind === 'error' ? 'alert' : 'status'}
              style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', fontWeight: 600, backgroundColor: messageKind === 'success' ? '#ecfdf5' : '#fef2f2', color: messageKind === 'success' ? '#065f46' : '#991b1b' }}
            >
              {message}
            </div>
          )}
        </div>

        <div>
          <h3>Template Library</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadTemplates} />
          ) : templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              body="Build a visit template so caregivers can complete plan-of-care tasks consistently."
              cta={{ label: 'Add a template', onClick: focusAddTemplate }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {templates.map(t => {
                const isExpanded = expandedId === t.id;
                return (
                  <li
                    key={t.id}
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
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        display: 'block'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{t.name}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem', minWidth: '1ch', textAlign: 'center' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        Client: {clientName(t.clientId)}
                      </div>
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {t.tasks.map((task, i) => (
                          <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px' }}>
                            {taskLabel(task)}
                          </span>
                        ))}
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
                        <div style={{ fontWeight: 600 }}>Template ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{t.id}</div>
                        <div style={{ fontWeight: 600 }}>Client</div>
                        <div>{clientName(t.clientId)}</div>
                        <div style={{ fontWeight: 600 }}>Name</div>
                        <div>{t.name}</div>
                        <div style={{ fontWeight: 600 }}>Tasks ({t.tasks.length})</div>
                        <div>{t.tasks.map(taskLabel).join(', ') || <em style={{ color: '#94a3b8' }}>none</em>}</div>
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