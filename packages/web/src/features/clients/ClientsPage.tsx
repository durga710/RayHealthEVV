import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidNumber?: string;
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [medicaidNumber, setMedicaidNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadClients = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getJson<Client[]>('/api/clients')
      .then((data) => {
        setClients(data || []);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load clients'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const focusAddClient = () => {
    document.getElementById('firstName')?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      const newClient = await postJson<Client>('/api/clients', {
        firstName,
        lastName,
        dateOfBirth,
        medicaidNumber: medicaidNumber || undefined
      });
      setClients((prev) => [...prev, newClient]);
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setMedicaidNumber('');
      setBanner({ kind: 'success', text: `Added ${newClient.firstName} ${newClient.lastName}.` });
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to add client.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Client Management</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Manage your clients and their demographic information.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>Add New Client</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="firstName">First Name</label>
                <input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="lastName">Last Name</label>
                <input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required />
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="dob">Date of Birth</label>
              <input id="dob" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="medicaid">Medicaid Number (Optional)</label>
              <input id="medicaid" value={medicaidNumber} onChange={e => setMedicaidNumber(e.target.value)} />
            </div>
            
            <button type="submit" disabled={submitting} style={submitting ? { opacity: 0.6, cursor: 'wait' } : undefined}>
              {submitting ? 'Adding…' : 'Add Client'}
            </button>
          </form>
          {banner && (
            <div
              role={banner.kind === 'error' ? 'alert' : 'status'}
              style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: banner.kind === 'success' ? '#ecfdf5' : '#fef2f2',
                color: banner.kind === 'success' ? '#065f46' : '#991b1b',
                borderRadius: '8px',
                fontWeight: 600
              }}
            >
              {banner.text}
            </div>
          )}
        </div>

        <div>
          <h3>Client Roster</h3>
          {loading ? (
            <LoadingSkeleton rows={5} columns={2} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadClients} />
          ) : clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              body="Add a client to start tracking demographics, Medicaid info, and care plans."
              cta={{ label: 'Add a client', onClick: focusAddClient }}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {clients.map(c => {
                const isExpanded = expandedId === c.id;
                return (
                  <li
                    key={c.id}
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
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
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
                        <strong>{c.firstName} {c.lastName}</strong>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>DOB: {c.dateOfBirth}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {c.medicaidNumber && (
                          <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '4px' }}>
                            Medicaid: {c.medicaidNumber}
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
                        <div style={{ fontWeight: 600 }}>Client ID</div>
                        <div style={{ fontFamily: 'monospace' }}>{c.id}</div>
                        <div style={{ fontWeight: 600 }}>Full name</div>
                        <div>{c.firstName} {c.lastName}</div>
                        <div style={{ fontWeight: 600 }}>Date of birth</div>
                        <div>{c.dateOfBirth}</div>
                        <div style={{ fontWeight: 600 }}>Medicaid #</div>
                        <div>{c.medicaidNumber || <em style={{ color: '#94a3b8' }}>not on file</em>}</div>
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