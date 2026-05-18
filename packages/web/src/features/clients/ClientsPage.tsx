import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidNumber?: string;
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [medicaidNumber, setMedicaidNumber] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getJson<Client[]>('/api/clients')
      .then(data => setClients(data || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const newClient = await postJson<Client>('/api/clients', { 
        firstName, 
        lastName, 
        dateOfBirth, 
        medicaidNumber 
      });
      setClients(prev => [...prev, newClient]);
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setMedicaidNumber('');
      setMessage('Client added successfully');
    } catch (err) {
      setMessage('Failed to add client');
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
            
            <button type="submit">Add Client</button>
          </form>
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Client Roster</h3>
          {clients.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', marginTop: '1rem' }}>
              No clients found. Add one to get started.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {clients.map(c => (
                <li key={c.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{c.firstName} {c.lastName}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>DOB: {c.dateOfBirth}</div>
                  </div>
                  {c.medicaidNumber && <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '4px' }}>Medicaid: {c.medicaidNumber}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}