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

// Select fields use the global .select-field class for consistency.

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
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Templates</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Create and manage plan-of-care visit templates.
          </p>
        </div>
        <button type="button" onClick={focusAddTemplate} className="btn-primary">
          New template
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>New template</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button
                type="button"
                onClick={fillSampleData}
                className="btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                Sample data
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="clientId" className="label">Client</label>
              <select id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required className="select-field">
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="name" className="label">Template Name</label>
              <input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Routine" required className="input-field" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label className="label">Select Tasks</label>
              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '0.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem',
                  backgroundColor: '#F8FAFC',
                }}
              >
                {availableTasks.length === 0 ? (
                  <span style={{ fontSize: '0.8125rem', color: '#94A3B8', padding: '0.6rem' }}>Loading tasks…</span>
                ) : (
                  availableTasks.map(task => {
                    const isSelected = selectedTasks.has(task.duty);
                    return (
                      <label
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          fontWeight: 400,
                          textTransform: 'none',
                          cursor: 'pointer',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                          transition: 'background-color 0.1s ease',
                          fontSize: '0.8125rem',
                          color: '#0F172A',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTaskToggle(task.duty)}
                          style={{ width: 'auto', accentColor: '#7c3aed' }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600 }}>{task.id}</span>
                        <span>{task.duty}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
              Create Template
            </button>
          </form>
          {message && (
            <div
              role={messageKind === 'error' ? 'alert' : 'status'}
              className={`info-banner ${messageKind === 'success' ? 'banner-success' : 'banner-error'}`}
              style={{ marginTop: '1rem' }}
            >
              {message}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Template library</h3>
            {!loading && !loadError && templates.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>{templates.length} total</span>
            )}
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} columns={3} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadTemplates} />
          ) : templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              body="Build a visit template so caregivers can complete plan-of-care tasks consistently."
              cta={{ label: 'Add a template', onClick: focusAddTemplate }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {templates.map(t => {
                const isExpanded = expandedId === t.id;
                return (
                  <div
                    key={t.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: 'white',
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      style={{
                        width: '100%',
                        padding: '1.1rem 1.25rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        display: 'block',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>{t.name}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.15rem' }}>
                            Client: {clientName(t.clientId)}
                          </div>
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>{isExpanded ? '▾' : '▸'}</span>
                      </div>
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {t.tasks.map((task, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.5rem',
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                              borderRadius: '4px',
                              fontWeight: 500,
                            }}
                          >
                            {taskLabel(task)}
                          </span>
                        ))}
                      </div>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          padding: '1rem 1.25rem',
                          borderTop: '1px solid #E2E8F0',
                          backgroundColor: '#F8FAFC',
                          fontSize: '0.8125rem',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.35rem 1.25rem',
                          color: '#475569',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>Template ID</div>
                        <div style={{ fontFamily: 'var(--font-mono)' }}>{t.id}</div>
                        <div style={{ fontWeight: 600 }}>Client</div>
                        <div>{clientName(t.clientId)}</div>
                        <div style={{ fontWeight: 600 }}>Name</div>
                        <div>{t.name}</div>
                        <div style={{ fontWeight: 600 }}>Tasks ({t.tasks.length})</div>
                        <div>{t.tasks.map(taskLabel).join(', ') || <em style={{ color: '#94A3B8' }}>none</em>}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}