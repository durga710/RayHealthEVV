import type { Knex } from 'knex';
import type { Agency, AgencyTheme } from '../domain/agency.js';

export interface AgencyRow {
  id: string;
  name: string;
  state: string;
  operating_tracks: string;
  medicaid_provider_number?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/** Billing-provider identity fed into the 837 claim. Nullable until set. */
export interface AgencyBillingIdentity {
  billingNpi: string | null;
  billingTaxId: string | null;
  billingAddress1: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingTaxonomy: string | null;
  clearinghouseId: string | null;
  medicaidProviderNumber: string | null;
}

export class AgencyRepository {
  constructor(private readonly db: Knex) {}

  async createAgency(agency: Agency): Promise<Agency> {
    const row: AgencyRow = {
      id: agency.id ?? crypto.randomUUID(),
      name: agency.name,
      state: agency.state,
      operating_tracks: JSON.stringify(agency.operatingTracks),
      medicaid_provider_number: agency.medicaidProviderNumber
    };

    const [inserted] = await this.db<AgencyRow>('agencies').insert(row).returning('*');
    return this.mapRowToAgency(inserted);
  }

  async findById(id: string): Promise<Agency | null> {
    const row = await this.db<AgencyRow>('agencies').where({ id }).first();
    return row ? this.mapRowToAgency(row) : null;
  }

  /**
   * Update an agency's mutable fields (today: just `name`). Returns the
   * updated row, or null if the agency doesn't exist. Used by the admin
   * AgencySetupPage save action, previously a stub that didn't persist.
   */
  async findAll(): Promise<Agency[]> {
    const rows = await this.db<AgencyRow>('agencies').select('*').orderBy('name');
    return rows.map((r) => this.mapRowToAgency(r));
  }

  async findTheme(id: string): Promise<AgencyTheme | null> {
    const row = await this.db('agencies').select('features').where({ id }).first();
    if (!row) return null;
    const features: Record<string, unknown> = typeof row.features === 'string' ? JSON.parse(row.features) : row.features ?? {};
    return (features.theme as AgencyTheme) ?? null;
  }

  async updateName(id: string, name: string): Promise<Agency | null> {
    const trimmed = name.trim();
    if (!trimmed) return this.findById(id);
    const [row] = await this.db<AgencyRow>('agencies')
      .where({ id })
      .update({ name: trimmed, updated_at: this.db.fn.now() as unknown as Date })
      .returning('*');
    return row ? this.mapRowToAgency(row) : null;
  }

  async updateBilling(
    id: string,
    data: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: string;
      subscriptionTier?: string;
    }
  ): Promise<void> {
    const patch: Partial<AgencyRow> = {};
    if (data.stripeCustomerId !== undefined) patch.stripe_customer_id = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined) patch.stripe_subscription_id = data.stripeSubscriptionId;
    if (data.subscriptionStatus !== undefined) patch.subscription_status = data.subscriptionStatus;
    if (data.subscriptionTier !== undefined) patch.subscription_tier = data.subscriptionTier;
    if (Object.keys(patch).length === 0) return;
    await this.db<AgencyRow>('agencies').where({ id }).update(patch);
  }

  async findByStripeCustomer(stripeCustomerId: string): Promise<Agency | null> {
    const row = await this.db<AgencyRow>('agencies')
      .where({ stripe_customer_id: stripeCustomerId })
      .first();
    return row ? this.mapRowToAgency(row) : null;
  }

  async getBillingStatus(id: string): Promise<{
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    subscriptionTier: string | null;
  } | null> {
    const row = await this.db<AgencyRow>('agencies')
      .where({ id })
      .select('stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_tier')
      .first();
    if (!row) return null;
    return {
      stripeCustomerId: row.stripe_customer_id ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      subscriptionStatus: row.subscription_status ?? null,
      subscriptionTier: row.subscription_tier ?? null,
    };
  }

  /**
   * Read the agency's billing-provider identity (the fields the 837 claim
   * needs: rendering/billing NPI, tax ID, service address, taxonomy,
   * clearinghouse + Medicaid provider numbers). All nullable until an admin
   * fills them in on the Billing & Clearinghouse setup screen.
   */
  async getBillingIdentity(id: string): Promise<AgencyBillingIdentity | null> {
    const row = (await this.db('agencies')
      .where({ id })
      .select(
        'billing_npi',
        'billing_tax_id',
        'billing_address1',
        'billing_city',
        'billing_state',
        'billing_postal_code',
        'billing_taxonomy',
        'clearinghouse_id',
        'medicaid_provider_number',
      )
      .first()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      billingNpi: (row.billing_npi as string | null) ?? null,
      billingTaxId: (row.billing_tax_id as string | null) ?? null,
      billingAddress1: (row.billing_address1 as string | null) ?? null,
      billingCity: (row.billing_city as string | null) ?? null,
      billingState: (row.billing_state as string | null) ?? null,
      billingPostalCode: (row.billing_postal_code as string | null) ?? null,
      billingTaxonomy: (row.billing_taxonomy as string | null) ?? null,
      clearinghouseId: (row.clearinghouse_id as string | null) ?? null,
      medicaidProviderNumber: (row.medicaid_provider_number as string | null) ?? null,
    };
  }

  /**
   * Update the agency's billing-provider identity. Only the keys present in
   * `data` are written, so admins can fill the profile incrementally. Returns
   * the full updated identity, or null if the agency doesn't exist.
   */
  async updateBillingIdentity(
    id: string,
    data: Partial<AgencyBillingIdentity>,
  ): Promise<AgencyBillingIdentity | null> {
    const colByKey: Record<keyof AgencyBillingIdentity, string> = {
      billingNpi: 'billing_npi',
      billingTaxId: 'billing_tax_id',
      billingAddress1: 'billing_address1',
      billingCity: 'billing_city',
      billingState: 'billing_state',
      billingPostalCode: 'billing_postal_code',
      billingTaxonomy: 'billing_taxonomy',
      clearinghouseId: 'clearinghouse_id',
      medicaidProviderNumber: 'medicaid_provider_number',
    };
    const patch: Record<string, string | null> = {};
    for (const [key, col] of Object.entries(colByKey) as [keyof AgencyBillingIdentity, string][]) {
      if (data[key] !== undefined) {
        const v = data[key];
        patch[col] = typeof v === 'string' ? v.trim() || null : null;
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = this.db.fn.now() as unknown as string;
      const updated = await this.db('agencies').where({ id }).update(patch);
      if (updated === 0) return null;
    }
    return this.getBillingIdentity(id);
  }

  /** Read the agency fee schedule (cents per billing unit, by HCPCS code). */
  async getFeeSchedule(id: string): Promise<Record<string, number>> {
    const row = (await this.db('agencies').where({ id }).select('fee_schedule').first()) as
      | { fee_schedule?: unknown }
      | undefined;
    if (!row?.fee_schedule) return {};
    const raw =
      typeof row.fee_schedule === 'string' ? JSON.parse(row.fee_schedule) : row.fee_schedule;
    const out: Record<string, number> = {};
    for (const [code, cents] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(cents);
      if (Number.isFinite(n) && n >= 0) out[code] = Math.round(n);
    }
    return out;
  }

  /** Replace the agency fee schedule. Returns the stored schedule. */
  async updateFeeSchedule(
    id: string,
    rates: Record<string, number>,
  ): Promise<Record<string, number> | null> {
    const clean: Record<string, number> = {};
    for (const [code, cents] of Object.entries(rates)) {
      const n = Number(cents);
      if (Number.isFinite(n) && n >= 0) clean[code] = Math.round(n);
    }
    const updated = await this.db('agencies')
      .where({ id })
      .update({
        fee_schedule: JSON.stringify(clean),
        updated_at: this.db.fn.now() as unknown as string,
      });
    if (updated === 0) return null;
    return clean;
  }

  private mapRowToAgency(row: AgencyRow): Agency {
    return {
      id: row.id,
      name: row.name,
      state: row.state as 'PA',
      operatingTracks: typeof row.operating_tracks === 'string' ? JSON.parse(row.operating_tracks) : row.operating_tracks,
      medicaidProviderNumber: row.medicaid_provider_number
    };
  }
}
