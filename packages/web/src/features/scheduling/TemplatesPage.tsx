import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

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

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [availableTasks, setAvailableTasks] = useState<PATask[]>([]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getJson<Template[]>('/api/templates')
      .then(data => setTemplates(data || []))
      .catch(console.error);
      
    getJson<PATask[]>('/api/tasks')
      .then(data => setAvailableTasks(data || []))
      .catch(console.error);
  }, []);

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
      setMessage('Template created successfully');
    } catch (err) {
      setMessage('Failed to create template');
    }
  };

  return (
    <div>
      <h2>Visit Templates</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Create and manage plan-of-care visit templates.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>New Template</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="clientId">Client ID</label>
              <input id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="name">Template Name</label>
              <input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Routine" required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label>Select Tasks</label>
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
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Template Library</h3>
          {templates.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', marginTop: '1rem' }}>
              No templates found.
            </div>
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
                        Client: {t.clientId.slice(0, 6)}...
                      </div>
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {t.tasks.map((task, i) => (
                          <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px' }}>
                            {task}
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
                        <div style={{ fontWeight: 600 }}>Client ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{t.clientId}</div>
                        <div style={{ fontWeight: 600 }}>Name</div>
                        <div>{t.name}</div>
                        <div style={{ fontWeight: 600 }}>Tasks ({t.tasks.length})</div>
                        <div>{t.tasks.join(', ') || <em style={{ color: '#94a3b8' }}>none</em>}</div>
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