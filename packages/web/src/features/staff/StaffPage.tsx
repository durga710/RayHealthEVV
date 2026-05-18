import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

interface StaffMember {
  id: string;
  email: string;
  role: string;
  status: string;
}

export function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('caregiver');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getJson<{ success: boolean; data: StaffMember[] }>('/api/staff')
      .then(res => setStaff(res.data || []))
      .catch(() => undefined);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const invite = await postJson<StaffMember>('/api/invites', { email, role });
      setStaff(prev => [...prev, invite]);
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
          {staff.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', marginTop: '1rem' }}>
              No staff found. Send an invite to add one.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {staff.map(s => (
                <li key={s.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{s.email}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Role: {s.role}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: s.status === 'pending' ? '#fef3c7' : '#e0f2fe', color: s.status === 'pending' ? '#d97706' : '#0284c7', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {s.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}