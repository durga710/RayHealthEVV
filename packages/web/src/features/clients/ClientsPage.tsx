import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson, putJson, deleteJson, ApiError } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidNumber?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
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
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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

  const fillSampleData = () => {
    setFirstName('Jane');
    setLastName('Doe');
    setDateOfBirth('1955-04-12');
    setMedicaidNumber('PA-1234567');
    setAddressLine1('123 Market St');
    setCity('Harrisburg');
    setStateCode('PA');
    setPostalCode('17101');
    setLatitude('40.2732');
    setLongitude('-76.8867');
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setMedicaidNumber('');
    setAddressLine1('');
    setCity('');
    setStateCode('');
    setPostalCode('');
    setLatitude('');
    setLongitude('');
  };

  const startEdit = (c: Client) => {
    setEditingId(c.id);
    setBanner(null);
    setConfirmDeleteId(null);
    setFirstName(c.firstName);
    setLastName(c.lastName);
    setDateOfBirth(c.dateOfBirth);
    setMedicaidNumber(c.medicaidNumber ?? '');
    setAddressLine1(c.addressLine1 ?? '');
    setCity(c.city ?? '');
    setStateCode(c.state ?? '');
    setPostalCode(c.postalCode ?? '');
    setLatitude(c.latitude != null ? String(c.latitude) : '');
    setLongitude(c.longitude != null ? String(c.longitude) : '');
    document.getElementById('firstName')?.focus();
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
    setBanner(null);
  };

  const handleDelete = async (c: Client) => {
    setRowError(null);
    try {
      await deleteJson(`/api/clients/${c.id}`);
      setClients((prev) => prev.filter((x) => x.id !== c.id));
      setConfirmDeleteId(null);
      setExpandedId(null);
      if (editingId === c.id) cancelEdit();
      setBanner({ kind: 'success', text: `Removed ${c.firstName} ${c.lastName}.` });
    } catch (err) {
      // 409 = client still has authorizations / templates; show the server hint.
      setRowError(
        err instanceof ApiError ? err.message : (err as Error).message || 'Failed to delete client.',
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    // Coordinates are optional, but if one is supplied both must be, and both
    // must parse, otherwise the geofence anchor would be silently incomplete.
    const lat = latitude.trim() ? Number(latitude) : undefined;
    const lng = longitude.trim() ? Number(longitude) : undefined;
    if ((lat === undefined) !== (lng === undefined)) {
      setBanner({ kind: 'error', text: 'Enter both latitude and longitude, or leave both blank.' });
      return;
    }
    if ((lat !== undefined && !Number.isFinite(lat)) || (lng !== undefined && !Number.isFinite(lng))) {
      setBanner({ kind: 'error', text: 'Latitude and longitude must be valid numbers.' });
      return;
    }

    const payload = {
      firstName,
      lastName,
      dateOfBirth,
      medicaidNumber: medicaidNumber || undefined,
      addressLine1: addressLine1.trim() || undefined,
      city: city.trim() || undefined,
      state: stateCode.trim() ? stateCode.trim().toUpperCase() : undefined,
      postalCode: postalCode.trim() || undefined,
      latitude: lat,
      longitude: lng,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await putJson<Client>(`/api/clients/${editingId}`, payload);
        setClients((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        setEditingId(null);
        resetForm();
        setBanner({ kind: 'success', text: `Updated ${updated.firstName} ${updated.lastName}.` });
      } else {
        const newClient = await postJson<Client>('/api/clients', payload);
        setClients((prev) => [...prev, newClient]);
        resetForm();
        setBanner({ kind: 'success', text: `Added ${newClient.firstName} ${newClient.lastName}.` });
      }
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to save client.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Gradient banner header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2d52 0%, #1a5fa8 60%, #2d7dd2 100%)',
          borderRadius: '12px',
          padding: '1.75rem 2rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 4px 24px rgba(15,45,82,0.18)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Clients
          </h1>
          <p style={{ margin: '0.3rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
            Manage your clients and their demographic information.
          </p>
        </div>
        <button
          type="button"
          onClick={focusAddClient}
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '8px',
            padding: '0.5rem 1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Add client
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        <div className="form-card" style={{ borderTop: '3px solid #107480' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>{editingId ? 'Edit client' : 'Add new client'}</h3>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
              <button
                type="button"
                onClick={fillSampleData}
                className="btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                Sample data
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="firstName" className="label">First Name</label>
                <input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required className="input-field" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="lastName" className="label">Last Name</label>
                <input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required className="input-field" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="dob" className="label">Date of Birth</label>
              <input id="dob" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required className="input-field" />
            </div>

            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#107480',
                }}
              >
                Show optional fields
              </summary>
              <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor="medicaid" className="label">Medicaid Number (Optional)</label>
                <input id="medicaid" value={medicaidNumber} onChange={e => setMedicaidNumber(e.target.value)} className="input-field" />
              </div>

              <div style={{ marginTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div>
                  <span className="label" style={{ display: 'block' }}>Service address &amp; EVV geofence</span>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748B', lineHeight: 1.5 }}>
                    The address where care is delivered. Add latitude &amp; longitude to
                    activate the clock-in / clock-out geofence, without coordinates,
                    location verification can&apos;t be enforced for this client.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="addr1" className="label">Street address</label>
                  <input id="addr1" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} className="input-field" autoComplete="off" />
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="city" className="label">City</label>
                    <input id="city" value={city} onChange={e => setCity(e.target.value)} className="input-field" />
                  </div>
                  <div style={{ width: '64px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="state" className="label">State</label>
                    <input id="state" value={stateCode} onChange={e => setStateCode(e.target.value)} maxLength={2} placeholder="PA" className="input-field" style={{ textTransform: 'uppercase' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="zip" className="label">ZIP</label>
                    <input id="zip" value={postalCode} onChange={e => setPostalCode(e.target.value)} maxLength={10} inputMode="numeric" className="input-field" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="lat" className="label">Latitude</label>
                    <input id="lat" value={latitude} onChange={e => setLatitude(e.target.value)} inputMode="decimal" placeholder="40.2732" className="input-field" />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label htmlFor="lng" className="label">Longitude</label>
                    <input id="lng" value={longitude} onChange={e => setLongitude(e.target.value)} inputMode="decimal" placeholder="-76.8867" className="input-field" />
                  </div>
                </div>
              </div>
            </details>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add Client'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn-ghost btn-sm">
                  Cancel
                </button>
              )}
            </div>
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

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#94A3B8',
              }}
            >
              Client roster
            </span>
            {!loading && !loadError && clients.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#107480',
                  background: 'rgba(16, 116, 128,0.1)',
                  border: '1px solid rgba(16, 116, 128,0.2)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.65rem',
                  letterSpacing: '0.04em',
                }}
              >
                {clients.length} client{clients.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} columns={3} />
          ) : loadError ? (
            <ErrorRetry message={loadError} onRetry={loadClients} />
          ) : clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              body="Add a client to start tracking demographics, Medicaid info, and care plans."
              cta={{ label: 'Add a client', onClick: focusAddClient }}
            />
          ) : (
            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date of birth</th>
                  <th>Medicaid #</th>
                  <th style={{ width: '40px' }} aria-label="expand" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const isExpanded = expandedId === c.id;
                  const initials = `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase();
                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        style={{ cursor: 'pointer' }}
                        aria-expanded={isExpanded}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              aria-hidden
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #107480 0%, #7fc7cf 100%)',
                                color: 'white',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <span style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</span>
                          </div>
                        </td>
                        <td style={{ color: '#475569', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{c.dateOfBirth}</td>
                        <td>
                          {c.medicaidNumber ? (
                            <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>{c.medicaidNumber}</span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>, </span>
                          )}
                        </td>
                        <td style={{ color: '#94A3B8' }}>{isExpanded ? '▾' : '▸'}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.25rem', fontSize: '0.8125rem', color: '#475569' }}>
                              <div style={{ fontWeight: 600 }}>Client ID</div>
                              <div style={{ fontFamily: 'var(--font-mono)' }}>{c.id}</div>
                              <div style={{ fontWeight: 600 }}>Full name</div>
                              <div>{c.firstName} {c.lastName}</div>
                              <div style={{ fontWeight: 600 }}>Date of birth</div>
                              <div>{c.dateOfBirth}</div>
                              <div style={{ fontWeight: 600 }}>Medicaid #</div>
                              <div>{c.medicaidNumber || <em style={{ color: '#94A3B8' }}>not on file</em>}</div>
                              <div style={{ fontWeight: 600 }}>Service address</div>
                              <div>
                                {c.addressLine1
                                  ? [c.addressLine1, c.city, c.state, c.postalCode].filter(Boolean).join(', ')
                                  : <em style={{ color: '#94A3B8' }}>not on file</em>}
                              </div>
                              <div style={{ fontWeight: 600 }}>EVV geofence</div>
                              <div>
                                {c.latitude != null && c.longitude != null ? (
                                  <span className="badge badge-success" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                    Active · {c.latitude}, {c.longitude}
                                  </span>
                                ) : (
                                  <span className="badge badge-warning" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                    Not set, location not enforced
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(c)}>
                                Edit
                              </button>
                              {confirmDeleteId === c.id ? (
                                <>
                                  <span style={{ fontSize: '0.8125rem', color: '#BE123C', fontWeight: 600 }}>Delete this client?</span>
                                  <button type="button" className="btn-sm" style={{ background: '#BE123C', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleDelete(c)}>
                                    Confirm delete
                                  </button>
                                  <button type="button" className="btn-ghost btn-sm" onClick={() => { setConfirmDeleteId(null); setRowError(null); }}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button type="button" className="btn-ghost btn-sm" style={{ color: '#BE123C' }} onClick={() => { setConfirmDeleteId(c.id); setRowError(null); }}>
                                  Delete
                                </button>
                              )}
                            </div>
                            {rowError && confirmDeleteId === c.id && (
                              <div role="alert" style={{ marginTop: '0.6rem', fontSize: '0.8125rem', color: '#BE123C' }}>
                                {rowError}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}