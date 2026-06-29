import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

/**
 * Go-Live Readiness checklist.
 *
 * Surfaces the silent onboarding gates — most importantly the fee schedule,
 * which otherwise lets claims generate $0 charges with no visible warning — and
 * links each unfinished item to the page that fixes it. Read-only: it fetches
 * the agency's billing identity, fee schedule, EVV aggregator config, and whether
 * any clients/staff exist, then computes pass/fail per item.
 */

const FEE_CODES = ['T1019', 'S5125', 'T1004', 'T1021'] as const;

interface BillingIdentity {
  billingNpi: string | null;
  billingTaxId: string | null;
  billingAddress1: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
}

interface SandataConfig {
  providerId: string | null;
  apiBaseUrl: string | null;
  hasCredentials: boolean;
  enabled: boolean;
}

export interface ChecklistItem {
  title: string;
  done: boolean;
  required: boolean;
  detail: string;
  fixTo: string;
  fixLabel: string;
}

export interface ReadinessInputs {
  billing: BillingIdentity;
  fees: Record<string, number>;
  sandata: SandataConfig;
  clientCount: number;
  staffCount: number;
}

/**
 * Pure derivation of the go-live checklist from the fetched setup state. Kept
 * separate from the component so the gating rules (especially "fee schedule
 * fully priced") can be unit-tested without rendering.
 */
export function computeReadinessChecklist(input: ReadinessInputs): ChecklistItem[] {
  const { billing, fees, sandata, clientCount, staffCount } = input;
  const billingComplete = Boolean(
    billing.billingNpi &&
      billing.billingTaxId &&
      billing.billingAddress1 &&
      billing.billingCity &&
      billing.billingState &&
      billing.billingPostalCode,
  );
  const pricedCodes = FEE_CODES.filter((c) => (fees?.[c] ?? 0) > 0);
  const feeComplete = pricedCodes.length === FEE_CODES.length;
  const evvComplete = Boolean(sandata.providerId && sandata.apiBaseUrl && sandata.hasCredentials && sandata.enabled);

  return [
    {
      title: 'Add at least one client',
      done: clientCount > 0,
      required: true,
      detail: 'You need a client (with a Medicaid ID and a geofence address) before any visit can be scheduled or verified.',
      fixTo: '/admin/clients',
      fixLabel: 'Manage clients',
    },
    {
      title: 'Add at least one caregiver / staff member',
      done: staffCount > 0,
      required: true,
      detail: 'Invite the staff who will deliver and verify visits.',
      fixTo: '/admin/staff',
      fixLabel: 'Manage staff',
    },
    {
      title: 'Complete the 837 billing identity',
      done: billingComplete,
      required: true,
      detail: 'Billing NPI, Tax ID (EIN), and service address are required on every 837 claim. Without them, claims cannot be generated.',
      fixTo: '/admin/agency',
      fixLabel: 'Agency Setup → Billing',
    },
    {
      title: 'Load the contracted fee schedule',
      done: feeComplete,
      required: true,
      detail: feeComplete
        ? 'All four PA service codes have a contracted rate.'
        : `Only ${pricedCodes.length} of ${FEE_CODES.length} service codes are priced. Claims for unpriced codes generate $0 charges and will be flagged at denial risk — set a rate for every code before billing.`,
      fixTo: '/admin/agency',
      fixLabel: 'Agency Setup → Fee schedule',
    },
    {
      title: 'Connect the EVV aggregator (Sandata)',
      done: evvComplete,
      required: true,
      detail: evvComplete
        ? 'Provider ID, endpoint, and credentials are set and submission is enabled.'
        : 'PA requires EVV visits to reach the state aggregator. Set the Provider ID, API endpoint, and credentials, then enable submission.',
      fixTo: '/admin/compliance-engine/evv-submission',
      fixLabel: 'EVV Submission setup',
    },
  ];
}

const card: React.CSSProperties = {
  background: 'var(--color-surface, #fff)',
  border: '1px solid var(--color-border, #E2E8F0)',
  borderRadius: 12,
  padding: '1rem 1.25rem',
  marginBottom: '0.75rem',
  display: 'flex',
  gap: '0.9rem',
  alignItems: 'flex-start',
};

function StatusDot({ done }: { done: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? 'var(--color-success-bg, #ECFDF5)' : 'var(--color-accent-bg, #FEF2F2)',
        color: done ? 'var(--color-success, #047857)' : 'var(--color-accent, #B91C1C)',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {done ? <polyline points="20 6 9 17 4 12" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
      </svg>
    </div>
  );
}

export function GoLiveReadinessPage() {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);
      const [billing, fees, sandataResp, clients, staff] = await Promise.all([
        safe(getJson<BillingIdentity>('/api/agencies/current/billing'), {} as BillingIdentity),
        safe(getJson<Record<string, number>>('/api/agencies/current/fee-schedule'), {}),
        safe(getJson<{ data: SandataConfig }>('/api/agencies/me/sandata-config'), { data: {} as SandataConfig }),
        safe(getJson<unknown[]>('/api/clients'), []),
        safe(getJson<unknown[]>('/api/staff'), []),
      ]);
      if (cancelled) return;

      setItems(
        computeReadinessChecklist({
          billing,
          fees: fees ?? {},
          sandata: sandataResp.data ?? ({} as SandataConfig),
          clientCount: Array.isArray(clients) ? clients.length : 0,
          staffCount: Array.isArray(staff) ? staff.length : 0,
        }),
      );
    }
    load().catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load readiness'));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.done).length ?? 0;
  const blockers = (items ?? []).filter((i) => i.required && !i.done).length;
  const ready = items !== null && blockers === 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
      <p style={{ color: 'var(--color-text-muted, #64748B)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
        Onboarding
      </p>
      <h1 style={{ margin: '0.25rem 0 0.5rem', fontSize: '1.6rem', color: 'var(--color-text, #0F172A)' }}>Go-Live Readiness</h1>
      <p style={{ margin: '0 0 1.25rem', color: 'var(--color-text-muted, #64748B)', fontSize: '0.95rem' }}>
        Everything an agency must finish before it can run verified visits and bill them. Each unfinished item links to where you fix it.
      </p>

      {error && (
        <div style={{ background: 'var(--color-accent-bg, #FEF2F2)', color: 'var(--color-accent, #B91C1C)', borderRadius: 8, padding: '0.75rem 1rem' }}>{error}</div>
      )}

      {items === null && !error && <p style={{ color: 'var(--color-text-muted, #64748B)' }}>Checking your setup…</p>}

      {items !== null && (
        <>
          <div
            style={{
              background: ready ? 'var(--color-success-bg, #ECFDF5)' : 'var(--color-primary-bg, #ECFEFF)',
              color: ready ? 'var(--color-success, #047857)' : 'var(--color-primary-dark, #0E7490)',
              border: `1px solid ${ready ? 'var(--color-success, #047857)' : 'var(--color-border, #E2E8F0)'}`,
              borderRadius: 12,
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              fontWeight: 600,
            }}
          >
            {ready
              ? `✓ Ready to onboard — all ${total} items complete.`
              : `${done} of ${total} complete · ${blockers} ${blockers === 1 ? 'item' : 'items'} left before go-live.`}
          </div>

          {items.map((item) => (
            <div key={item.title} style={card}>
              <StatusDot done={item.done} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text, #0F172A)' }}>{item.title}</h3>
                  {!item.done && (
                    <Link to={item.fixTo} style={{ color: 'var(--color-primary, #107480)', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      {item.fixLabel} →
                    </Link>
                  )}
                </div>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted, #64748B)', fontSize: '0.85rem', lineHeight: 1.5 }}>{item.detail}</p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
