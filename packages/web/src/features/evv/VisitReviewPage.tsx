import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged';
}

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const data = await getJson<EvvVisit[]>('/api/evv/visits');
      setVisits(data || []);
    } catch (err) {
      console.error('Failed to fetch visits', err);
    } finally {
      setLoading(false);
    }
  };

  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);

  const handleRequestCorrection = async (visitId: string) => {
    setMessage('');
    setPendingVisitId(visitId);
    try {
      await postJson('/api/maintenance/request-unlock', {
        visitId,
        reason: 'Coordinator requested EVV correction review from Visit Review'
      });
      setMessage('Correction request created successfully');
      fetchVisits();
      // Auto-clear success message after 4s so the row's hover state isn't masked.
      setTimeout(() => setMessage((current) => (current === 'Correction request created successfully' ? '' : current)), 4000);
    } catch (err) {
      console.error('Failed to create correction request', err);
      setMessage('Failed to create correction request');
    } finally {
      setPendingVisitId(null);
    }
  };

  return (
    <div>
      <h2>EVV Visit Review</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Review electronically verified visits and open maintenance requests when corrections are needed.
      </p>

      {message && <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}

      {loading ? (
        <p>Loading visits...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem' }}>Caregiver</th>
              <th style={{ padding: '0.75rem' }}>Clock In</th>
              <th style={{ padding: '0.75rem' }}>Clock Out</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
              <th style={{ padding: '0.75rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr key={visit.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem' }}>{visit.caregiverId.slice(0, 8)}...</td>
                <td style={{ padding: '0.75rem' }}>{new Date(visit.clockInTime).toLocaleString()}</td>
                <td style={{ padding: '0.75rem' }}>{visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : 'N/A'}</td>
                <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{visit.status}</td>
                <td style={{ padding: '0.75rem' }}>
                  {visit.status === 'pending' && (
                    <button
                      onClick={() => handleRequestCorrection(visit.id)}
                      disabled={pendingVisitId === visit.id}
                      aria-busy={pendingVisitId === visit.id}
                    >
                      {pendingVisitId === visit.id ? 'Requesting…' : 'Request Correction'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
