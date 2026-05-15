import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged' | 'corrected';
}

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await getJson<EvvVisit[]>('/api/evv/visits');
      setVisits(data || []);
    } catch (err) {
      console.error('Failed to fetch visits', err);
      setLoadError((err as Error).message || 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCorrection = async (id: string) => {
    setMessage('');
    try {
      await postJson('/api/maintenance/request-unlock', {
        visitId: id,
        reason: 'Coordinator requested EVV correction review from Visit Review'
      });
      setMessage('Correction request submitted');
      fetchVisits(); // Refresh list
    } catch (err) {
      setMessage('Failed to request correction');
    }
  };

  return (
    <div>
      <h2>EVV Visit Review</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Review electronically verified visits and route corrections through visit maintenance.
      </p>

      {message && <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '8px' }}>{message}</div>}

      {loading ? (
        <LoadingSkeleton rows={6} columns={5} />
      ) : loadError ? (
        <ErrorRetry message={loadError} onRetry={fetchVisits} />
      ) : visits.length === 0 ? (
        <EmptyState
          title="No visits yet"
          body="Verified visits will appear here once caregivers complete a clock-in/clock-out cycle."
        />
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
                  {(visit.status === 'pending' || visit.status === 'flagged') && (
                    <button onClick={() => handleRequestCorrection(visit.id)}>Request Correction</button>
                  )}
                  {(visit.status === 'verified' || visit.status === 'corrected') && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Closed</span>
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
