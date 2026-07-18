import React, { useEffect, useState } from 'react';
import { getJson, putJson } from '../../lib/api-client.js';

interface Agency {
  id: string;
  name: string;
  state: string;
}

interface BillingForm {
  billingNpi: string;
  billingTaxId: string;
  billingAddress1: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingTaxonomy: string;
  clearinghouseId: string;
  medicaidProviderNumber: string;
}

const EMPTY_BILLING: BillingForm = {
  billingNpi: '',
  billingTaxId: '',
  billingAddress1: '',
  billingCity: '',
  billingState: 'PA',
  billingPostalCode: '',
  billingTaxonomy: '',
  clearinghouseId: '',
  medicaidProviderNumber: '',
};

// 837 billing-provider fields, in display order. `required` marks the fields a
// clearinghouse needs before an 837 can be generated.
const BILLING_FIELDS: Array<{ key: keyof BillingForm; label: string; placeholder: string; required: boolean }> = [
  { key: 'billingNpi', label: 'Billing NPI', placeholder: '10-digit NPI', required: true },
  { key: 'billingTaxId', label: 'Tax ID (EIN)', placeholder: '9-digit EIN', required: true },
  { key: 'medicaidProviderNumber', label: 'PA Medicaid Provider #', placeholder: 'PROMISe provider id', required: false },
  { key: 'billingTaxonomy', label: 'Taxonomy Code', placeholder: '10-char taxonomy', required: false },
  { key: 'billingAddress1', label: 'Service Address', placeholder: 'Street address', required: true },
  { key: 'billingCity', label: 'City', placeholder: 'City', required: true },
  { key: 'billingState', label: 'State', placeholder: 'PA', required: true },
  { key: 'billingPostalCode', label: 'ZIP Code', placeholder: '12345 or 12345-6789', required: true },
  { key: 'clearinghouseId', label: 'Clearinghouse / Submitter ID', placeholder: 'Trading-partner id', required: false },
];

// PA HCPCS service codes that carry a per-unit rate.
const FEE_CODES: Array<{ code: string; label: string; unit: string }> = [
  { code: 'T1019', label: 'T1019. Personal care', unit: 'per 15 min' },
  { code: 'S5125', label: 'S5125. Attendant care', unit: 'per 15 min' },
  { code: 'T1004', label: 'T1004. Qualified aide services', unit: 'per 15 min' },
  { code: 'T1021', label: 'T1021. Home health aide', unit: 'per visit' },
];

function centsToDollars(cents: number | undefined): string {
  if (cents === undefined || cents === null) return '';
  return (cents / 100).toFixed(2);
}

function billingFromApi(data: Partial<Record<keyof BillingForm, string | null>>): BillingForm {
  return {
    billingNpi: data.billingNpi ?? '',
    billingTaxId: data.billingTaxId ?? '',
    billingAddress1: data.billingAddress1 ?? '',
    billingCity: data.billingCity ?? '',
    billingState: data.billingState ?? 'PA',
    billingPostalCode: data.billingPostalCode ?? '',
    billingTaxonomy: data.billingTaxonomy ?? '',
    clearinghouseId: data.clearinghouseId ?? '',
    medicaidProviderNumber: data.medicaidProviderNumber ?? '',
  };
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

interface PublicPageProfile {
  displayName?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  hours?: string;
  services?: { name: string; blurb?: string }[];
}

export function AgencySetupPage() {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [name, setName] = useState('');
  const [banner, setBanner] = useState<Banner>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [billing, setBilling] = useState<BillingForm>(EMPTY_BILLING);
  const [billingBanner, setBillingBanner] = useState<Banner>(null);
  const [billingSaving, setBillingSaving] = useState(false);

  // Fee schedule held as dollar strings per code for editing.
  const [fees, setFees] = useState<Record<string, string>>({});
  const [feeBanner, setFeeBanner] = useState<Banner>(null);
  const [feeSaving, setFeeSaving] = useState(false);

  // Public hiring page (rayhealthevv.com/<slug>).
  const [pageSlug, setPageSlug] = useState('');
  const [pageAbout, setPageAbout] = useState('');
  const [pageDisplayName, setPageDisplayName] = useState('');
  const [pageTagline, setPageTagline] = useState('');
  const [pagePhone, setPagePhone] = useState('');
  const [pageEmail, setPageEmail] = useState('');
  const [pageAddress, setPageAddress] = useState('');
  const [pageHours, setPageHours] = useState('');
  // One service per line, 'Name: short description'.
  const [pageServices, setPageServices] = useState('');
  // Only send the profile once we've loaded the stored one , if the initial
  // GET failed, submitting empty fields must not wipe the server's copy (the
  // API preserves the profile when the field is omitted).
  const [pageProfileLoaded, setPageProfileLoaded] = useState(false);
  const [pageBanner, setPageBanner] = useState<Banner>(null);
  const [pageSaving, setPageSaving] = useState(false);

  useEffect(() => {
    getJson<Agency>('/api/agencies/current')
      .then(data => {
        setAgency(data);
        setName(data.name);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load agency'))
      .finally(() => setLoading(false));
    getJson<Partial<Record<keyof BillingForm, string | null>>>('/api/agencies/current/billing')
      .then(data => setBilling(billingFromApi(data)))
      .catch(() => { /* billing profile optional on first load */ });
    getJson<Record<string, number>>('/api/agencies/current/fee-schedule')
      .then(data => {
        const asDollars: Record<string, string> = {};
        FEE_CODES.forEach(({ code }) => { asDollars[code] = centsToDollars(data[code]); });
        setFees(asDollars);
      })
      .catch(() => { /* fee schedule optional on first load */ });
    getJson<{ slug: string | null; about: string | null; profile: PublicPageProfile | null }>(
      '/api/agencies/current/public-page',
    )
      .then(data => {
        setPageSlug(data.slug ?? '');
        setPageAbout(data.about ?? '');
        const prof = data.profile ?? {};
        setPageDisplayName(prof.displayName ?? '');
        setPageTagline(prof.tagline ?? '');
        setPagePhone(prof.phone ?? '');
        setPageEmail(prof.email ?? '');
        setPageAddress(prof.addressLine ?? '');
        setPageHours(prof.hours ?? '');
        setPageServices(
          (prof.services ?? []).map(s => (s.blurb ? `${s.name}: ${s.blurb}` : s.name)).join('\n'),
        );
        setPageProfileLoaded(true);
      })
      .catch(() => { /* public page optional on first load */ });
  }, []);

  const handlePublicPageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageBanner(null);
    setPageSaving(true);
    // 'Name: blurb' per line → services array (blank lines skipped).
    const services = pageServices
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map(line => {
        const idx = line.indexOf(':');
        return idx > 0
          ? { name: line.slice(0, idx).trim(), blurb: line.slice(idx + 1).trim() || undefined }
          : { name: line };
      });
    const profile: PublicPageProfile = {
      displayName: pageDisplayName.trim() || undefined,
      tagline: pageTagline.trim() || undefined,
      phone: pagePhone.trim() || undefined,
      email: pageEmail.trim() || undefined,
      addressLine: pageAddress.trim() || undefined,
      hours: pageHours.trim() || undefined,
      services: services.length > 0 ? services : undefined,
    };
    const hasProfile = Object.values(profile).some(v => v !== undefined);
    try {
      const saved = await putJson<{ slug: string | null; about: string | null }>(
        '/api/agencies/current/public-page',
        {
          slug: pageSlug.trim() || null,
          about: pageAbout.trim() || null,
          // Omit the field entirely when the stored profile never loaded ,
          // the API preserves it; sending null here would wipe it.
          ...(pageProfileLoaded ? { profile: hasProfile ? profile : null } : {}),
        },
      );
      setPageSlug(saved.slug ?? '');
      setPageAbout(saved.about ?? '');
      setPageBanner({
        kind: 'success',
        text: saved.slug
          ? `Public page saved. Your hiring page is live at ${window.location.origin}/${saved.slug}`
          : 'Public page taken offline.',
      });
    } catch (err) {
      setPageBanner({ kind: 'error', text: (err as Error).message || 'Failed to save public page.' });
    } finally {
      setPageSaving(false);
    }
  };

  const handleFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeBanner(null);
    setFeeSaving(true);
    // Convert dollar inputs to integer cents; omit blank rows.
    const payload: Record<string, number> = {};
    let invalid = false;
    FEE_CODES.forEach(({ code }) => {
      const raw = (fees[code] ?? '').trim();
      if (!raw) return;
      const dollars = Number(raw);
      if (!Number.isFinite(dollars) || dollars < 0) { invalid = true; return; }
      payload[code] = Math.round(dollars * 100);
    });
    if (invalid) {
      setFeeBanner({ kind: 'error', text: 'Rates must be non-negative dollar amounts.' });
      setFeeSaving(false);
      return;
    }
    try {
      const updated = await putJson<Record<string, number>>(
        '/api/agencies/current/fee-schedule',
        payload,
      );
      const asDollars: Record<string, string> = {};
      FEE_CODES.forEach(({ code }) => { asDollars[code] = centsToDollars(updated[code]); });
      setFees(asDollars);
      setFeeBanner({ kind: 'success', text: 'Fee schedule saved.' });
    } catch (err) {
      setFeeBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to save fee schedule.' });
    } finally {
      setFeeSaving(false);
    }
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingBanner(null);
    setBillingSaving(true);
    // Only send non-empty fields, the API validates format per field and
    // leaves omitted fields untouched.
    const payload: Partial<BillingForm> = {};
    (Object.keys(billing) as Array<keyof BillingForm>).forEach(k => {
      const v = billing[k].trim();
      if (v) payload[k] = v;
    });
    try {
      const updated = await putJson<Partial<Record<keyof BillingForm, string | null>>>(
        '/api/agencies/current/billing',
        payload,
      );
      setBilling(billingFromApi(updated));
      setBillingBanner({ kind: 'success', text: 'Billing & clearinghouse profile saved.' });
    } catch (err) {
      setBillingBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to save billing profile.',
      });
    } finally {
      setBillingSaving(false);
    }
  };

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
        <div className="form-card" style={{ borderTop: '3px solid #107480' }}>
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
                State is locked to Pennsylvania. RayHealthEVV™ is purpose-built for PA DHS Personal Assistance Services.
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
            RayHealthEVV™ is purpose-built for Pennsylvania DHS Personal Assistance Services, ensuring full compliance with state and federal requirements.
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

      {/* Billing & Clearinghouse, 837 billing-provider identity */}
      <div className="form-card" style={{ borderTop: '3px solid #107480', marginTop: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
          Billing &amp; Clearinghouse
        </h2>
        <p style={{ margin: '0 0 1.1rem', fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.6 }}>
          Your billing-provider identity for X12 837P claims. Required fields (marked&nbsp;
          <span style={{ color: '#DC2626' }}>*</span>) must be complete before an 837 can be generated
          for a payer or clearinghouse.
        </p>
        <form onSubmit={handleBillingSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {BILLING_FIELDS.map(f => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor={f.key} className="label">
                  {f.label}{f.required ? <span style={{ color: '#DC2626' }}> *</span> : null}
                </label>
                <input
                  id={f.key}
                  value={billing[f.key]}
                  onChange={e => setBilling(b => ({ ...b, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="input-field"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={billingSaving}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', marginTop: '1.1rem' }}
          >
            {billingSaving ? 'Saving…' : 'Save Billing Profile'}
          </button>
        </form>
        {billingBanner && (
          <div
            role={billingBanner.kind === 'error' ? 'alert' : 'status'}
            className={`info-banner ${billingBanner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
            style={{ marginTop: '1rem' }}
          >
            {billingBanner.text}
          </div>
        )}
      </div>

      {/* Fee Schedule, cents per billing unit by HCPCS code */}
      <div className="form-card" style={{ borderTop: '3px solid #107480', marginTop: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
          Fee Schedule
        </h2>
        <p style={{ margin: '0 0 1.1rem', fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.6 }}>
          Your contracted rate per billing unit for each PA service code. Claims compute charges from
          these rates, a code left blank bills $0.00 and is flagged before submission.
        </p>
        <form onSubmit={handleFeeSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {FEE_CODES.map(f => (
              <div key={f.code} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label htmlFor={`fee-${f.code}`} className="label">
                  {f.label} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({f.unit})</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#64748B' }}>$</span>
                  <input
                    id={`fee-${f.code}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={fees[f.code] ?? ''}
                    onChange={e => setFees(s => ({ ...s, [f.code]: e.target.value }))}
                    placeholder="0.00"
                    className="input-field"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={feeSaving}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', marginTop: '1.1rem' }}
          >
            {feeSaving ? 'Saving…' : 'Save Fee Schedule'}
          </button>
        </form>
        {feeBanner && (
          <div
            role={feeBanner.kind === 'error' ? 'alert' : 'status'}
            className={`info-banner ${feeBanner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
            style={{ marginTop: '1rem' }}
          >
            {feeBanner.text}
          </div>
        )}
      </div>

      {/* Public hiring page, rayhealthevv.com/<slug> */}
      <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 800 }}>
          Public hiring page
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#64748B', fontSize: '0.85rem' }}>
          Give your agency a public homepage and caregiver application page. Share the link on job
          boards — applicants apply, complete the guided interview, and upload their documents
          without an account.
        </p>
        <form onSubmit={handlePublicPageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: 480 }}>
            <label htmlFor="publicSlug" className="label">Page address</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{window.location.origin}/</span>
              <input
                id="publicSlug"
                className="input-field"
                value={pageSlug}
                onChange={e => setPageSlug(e.target.value)}
                placeholder="cyanjel-care-llc"
                style={{ flex: 1 }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Lowercase letters, numbers, and hyphens. Leave blank to take the page offline.
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="publicDisplayName" className="label">Display name</label>
              <input id="publicDisplayName" className="input-field" maxLength={120} value={pageDisplayName} onChange={e => setPageDisplayName(e.target.value)} placeholder="Cyanjel Home Care" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="publicTagline" className="label">Tagline</label>
              <input id="publicTagline" className="input-field" maxLength={160} value={pageTagline} onChange={e => setPageTagline(e.target.value)} placeholder="Because Home Is Where Care Feels Best" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="publicPhone" className="label">Phone</label>
              <input id="publicPhone" className="input-field" maxLength={30} value={pagePhone} onChange={e => setPagePhone(e.target.value)} placeholder="(412) 555-0100" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="publicEmail" className="label">Public email</label>
              <input id="publicEmail" className="input-field" type="email" maxLength={200} value={pageEmail} onChange={e => setPageEmail(e.target.value)} placeholder="hello@youragency.com" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="publicAddress" className="label">Office address</label>
              <input id="publicAddress" className="input-field" maxLength={200} value={pageAddress} onChange={e => setPageAddress(e.target.value)} placeholder="90 Clairton Blvd, STE 09, Pittsburgh, PA 15236" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="publicHours" className="label">Office hours</label>
              <input id="publicHours" className="input-field" maxLength={120} value={pageHours} onChange={e => setPageHours(e.target.value)} placeholder="Mon–Fri 10:00am–5:00pm" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="publicAbout" className="label">About your agency</label>
            <textarea
              id="publicAbout"
              className="input-field"
              rows={4}
              maxLength={2000}
              value={pageAbout}
              onChange={e => setPageAbout(e.target.value)}
              placeholder="Tell applicants who you are, the communities you serve, and why caregivers love working with you."
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label htmlFor="publicServices" className="label">Services <span style={{ color: '#94A3B8', fontWeight: 400 }}>(one per line, "Name: short description")</span></label>
            <textarea
              id="publicServices"
              className="input-field"
              rows={6}
              value={pageServices}
              onChange={e => setPageServices(e.target.value)}
              placeholder={'Personal Care: Assistance with bathing, grooming, dressing, and mobility\nCompanionship: Friendly support and meaningful interaction'}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="submit" disabled={pageSaving} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              {pageSaving ? 'Saving…' : 'Save Public Page'}
            </button>
            {pageSlug.trim() && (
              // Href built only from the slug's legal charset , raw input never
              // reaches the attribute (CodeQL js/xss-through-dom).
              <a href={`/${pageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#107480', fontWeight: 700, fontSize: '0.85rem' }}>
                View live page →
              </a>
            )}
          </div>
        </form>
        {pageBanner && (
          <div
            role={pageBanner.kind === 'error' ? 'alert' : 'status'}
            className={`info-banner ${pageBanner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
            style={{ marginTop: '1rem' }}
          >
            {pageBanner.text}
          </div>
        )}
      </div>
    </div>
  );
}
