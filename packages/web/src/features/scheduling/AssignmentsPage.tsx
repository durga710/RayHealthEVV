import React, { useState } from 'react';
import { postJson } from '../../lib/api-client.js';

export function AssignmentsPage() {
  const [clientId, setClientId] = useState('');
  const [caregiverId, setCaregiverId] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await postJson('/api/assignments', { clientId, caregiverId });
      setMessage('Assignment created');
    } catch (e) {
      setMessage('Failed to create assignment');
    }
  };

  return (
    <div>
      <h1>Assignments</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="client-id">Client ID</label>
        <input id="client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        
        <br />
        <label htmlFor="caregiver-id">Caregiver ID</label>
        <input id="caregiver-id" value={caregiverId} onChange={(e) => setCaregiverId(e.target.value)} />
        
        <br />
        <button type="submit">Create Assignment</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
