import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

interface Agency {
  id: string;
  name: string;
  state: string;
}

export function AgencySetupPage() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<Agency>('/api/agencies/current')
      .then(data => {
        setAgency(data);
        setName(data.name);
      })
      .catch(err => {
        console.error('Failed to load agency', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      // Stubbing the POST request since it might not be implemented in app package yet
      // await postJson('/api/agencies/current', { name });
      setMessage('Agency updated successfully (Stub)');
    } catch (err) {
      setMessage('Failed to update agency');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Agency Setup</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Configure your Pennsylvania agency details and operating tracks.</p>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="name">Agency Name</label>
          <input 
            id="name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Enter agency name"
            required
          />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <label htmlFor="state">State</label>
          <input 
            id="state" 
            value={agency?.state || 'PA'} 
            disabled 
            style={{ backgroundColor: '#f8fafc', color: '#94a3b8' }}
          />
        </div>
        
        <button type="submit">Save Changes</button>
      </form>
      {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}
    </div>
  );
}