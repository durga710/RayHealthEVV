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

  const gradientBanner = (
    <div
      style={{
        background: 'linear-gradient(135deg, #0f2d52 0%, #1a5fa8 60%, #2d7dd2 100%)',
        borderRadius: '12px',
        padding: '1.75rem 2rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 24px rgba(15,45,82,0.18)',
      }}
    >
      <h1 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
        Agency Setup
      </h1>
      <p style={{ margin: '0.3rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
        Configure your Pennsylvania agency details.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div>
        {gradientBanner}
        <div style={{ padding: '2rem', color: '#94A3B8' }}>Loading agency details…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        {gradientBanner}
        <div role="alert" className="info-banner banner-error">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div>
      {gradientBanner}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 480px) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        <div className="form-card" style={{ borderTop: '3px solid #7c3aed' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="agencyName" className="label">Agency Name</label>
              <input
                id="agencyName"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter agency name"
                required
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="agencyState" className="label">State</label>
              <input
                id="agencyState"
                value={agency?.state || 'PA'}
                disabled
                className="input-field"
              />
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>
                State is locked to Pennsylvania. RayHealth EVV is purpose-built for PA DHS Personal Assistance Services.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim() || name === agency?.name}
              className="btn-primary"
              style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          {banner && (
            <div
              role={banner.kind === 'error' ? 'alert' : 'status'}
              className={`info-banner ${banner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
              style={{ marginTop: '1rem' }}
            >
              {banner.text}
            </div>
          )}
        </div>

        {/* Info card */}
        <div
          style={{
            background: '#0F172A',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #1E293B',
          }}
        >
          <p style={{ margin: '0 0 0.75rem', color: '#E2E8F0', fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Pennsylvania Only
          </p>
          <p style={{ margin: '0 0 1rem', color: '#94A3B8', fontSize: '0.8125rem', lineHeight: 1.6 }}>
            RayHealth EVV is purpose-built for Pennsylvania DHS Personal Assistance Services, ensuring full compliance with state and federal requirements.
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {[
              'Purpose-built for PA DHS PAS',
              '21st Century Cures Act compliance',
              'Sandata aggregator ready',
            ].map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', color: '#94A3B8' }}>
                <span style={{ color: '#10B981', display: 'flex', flexShrink: 0, marginTop: '0.1rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
