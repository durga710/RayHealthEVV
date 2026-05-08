import React, { useState } from 'react';
import { postJson } from '../../lib/api-client.js';

export function StaffPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('caregiver');
  const [message, setMessage] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      await postJson('/api/invites', { email, role });
      setMessage(`Invite sent to ${email}`);
      setEmail('');
    } catch (err) {
      setMessage('Failed to send invite');
    }
  };

  return (
    <div>
      <h2>Staff Management</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Manage caregivers, coordinators, and invite new staff members.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>Invite Staff Member</h3>
          <form onSubmit={handleInvite} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="email">Email Address</label>
              <input 
                id="email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="staff@example.com"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label htmlFor="role">Role</label>
              <select 
                id="role" 
                value={role} 
                onChange={e => setRole(e.target.value)}
                style={{ padding: '0.75rem 1rem', border: '1px solid #c9d8e8', borderRadius: '8px', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                <option value="caregiver">Caregiver</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <button type="submit">Send Invite</button>
          </form>
          {message && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '8px' }}>{message}</div>}
        </div>

        <div>
          <h3>Active Staff Directory</h3>
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', marginTop: '1rem' }}>
            Directory loading...
          </div>
        </div>
      </div>
    </div>
  );
}