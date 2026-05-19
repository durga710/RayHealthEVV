import React, { useEffect, useState } from 'react';
import { getJson, putJson } from '../../lib/api-client.js';

interface Agency {
  id: string;
  name: string;
  state: string;
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

export function AgencySetupPage() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [banner, setBanner] = useState<Banner>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJson<Agency>('/api/agencies/current')
      .then(data => {
        setAgency(data);
        setName(data.name);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load agency'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setSaving(true);
    try {
      const updated = await putJson<Agency>('/api/agencies/current', { name });
      setAgency(updated);
      setName(updated.name);
      setBanner({ kind: 'success', text: 'Agency details saved.' });
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to update agency.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading agency details…</div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" style={{ padding: '1rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px' }}>
        {loadError}
      </div>
    );
  }

  return (
    <div>
      <h2>Agency Setup</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>Configure your Pennsylvania agency details and operating tracks.</p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="agencyName">Agency Name</label>
          <input
            id="agencyName"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter agency name"
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <label htmlFor="agencyState">State</label>
          <input
            id="agencyState"
            value={agency?.state || 'PA'}
            disabled
            style={{ backgroundColor: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }}
          />
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
            State is locked to Pennsylvania. RayHealth EVV is purpose-built for PA DHS
            Personal Assistance Services and cannot be reconfigured for other states.
          </p>
        </div>

        <button type="submit" disabled={saving || !name.trim() || name === agency?.name}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {banner && (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          style={{
            marginTop: '1rem', padding: '1rem', borderRadius: '8px', fontWeight: 600, maxWidth: '480px',
            backgroundColor: banner.kind === 'success' ? '#ecfdf5' : '#fef2f2',
            color: banner.kind === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {banner.text}
        </div>
      )}
    </div>
  );
}
