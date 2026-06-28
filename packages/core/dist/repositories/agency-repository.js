export class AgencyRepository {
    constructor(db) {
        this.db = db;
    }
    async createAgency(agency) {
        const row = {
            id: agency.id ?? crypto.randomUUID(),
            name: agency.name,
            state: agency.state,
            operating_tracks: JSON.stringify(agency.operatingTracks),
            medicaid_provider_number: agency.medicaidProviderNumber
        };
        const [inserted] = await this.db('agencies').insert(row).returning('*');
        return this.mapRowToAgency(inserted);
    }
    async findById(id) {
        const row = await this.db('agencies').where({ id }).first();
        return row ? this.mapRowToAgency(row) : null;
    }
    /**
     * Update an agency's mutable fields (today: just `name`). Returns the
     * updated row, or null if the agency doesn't exist. Used by the admin
     * AgencySetupPage save action — previously a stub that didn't persist.
     */
    async findAll() {
        const rows = await this.db('agencies').select('*').orderBy('name');
        return rows.map((r) => this.mapRowToAgency(r));
    }
    async findTheme(id) {
        const row = await this.db('agencies').select('features').where({ id }).first();
        if (!row)
            return null;
        const features = typeof row.features === 'string' ? JSON.parse(row.features) : row.features ?? {};
        return features.theme ?? null;
    }
    async updateName(id, name) {
        const trimmed = name.trim();
        if (!trimmed)
            return this.findById(id);
        const [row] = await this.db('agencies')
            .where({ id })
            .update({ name: trimmed, updated_at: this.db.fn.now() })
            .returning('*');
        return row ? this.mapRowToAgency(row) : null;
    }
    async updateBilling(id, data) {
        const patch = {};
        if (data.stripeCustomerId !== undefined)
            patch.stripe_customer_id = data.stripeCustomerId;
        if (data.stripeSubscriptionId !== undefined)
            patch.stripe_subscription_id = data.stripeSubscriptionId;
        if (data.subscriptionStatus !== undefined)
            patch.subscription_status = data.subscriptionStatus;
        if (data.subscriptionTier !== undefined)
            patch.subscription_tier = data.subscriptionTier;
        if (Object.keys(patch).length === 0)
            return;
        await this.db('agencies').where({ id }).update(patch);
    }
    async findByStripeCustomer(stripeCustomerId) {
        const row = await this.db('agencies')
            .where({ stripe_customer_id: stripeCustomerId })
            .first();
        return row ? this.mapRowToAgency(row) : null;
    }
    async getBillingStatus(id) {
        const row = await this.db('agencies')
            .where({ id })
            .select('stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_tier')
            .first();
        if (!row)
            return null;
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
    async getBillingIdentity(id) {
        const row = (await this.db('agencies')
            .where({ id })
            .select('billing_npi', 'billing_tax_id', 'billing_address1', 'billing_city', 'billing_state', 'billing_postal_code', 'billing_taxonomy', 'clearinghouse_id', 'medicaid_provider_number')
            .first());
        if (!row)
            return null;
        return {
            billingNpi: row.billing_npi ?? null,
            billingTaxId: row.billing_tax_id ?? null,
            billingAddress1: row.billing_address1 ?? null,
            billingCity: row.billing_city ?? null,
            billingState: row.billing_state ?? null,
            billingPostalCode: row.billing_postal_code ?? null,
            billingTaxonomy: row.billing_taxonomy ?? null,
            clearinghouseId: row.clearinghouse_id ?? null,
            medicaidProviderNumber: row.medicaid_provider_number ?? null,
        };
    }
    /**
     * Update the agency's billing-provider identity. Only the keys present in
     * `data` are written, so admins can fill the profile incrementally. Returns
     * the full updated identity, or null if the agency doesn't exist.
     */
    async updateBillingIdentity(id, data) {
        const colByKey = {
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
        const patch = {};
        for (const [key, col] of Object.entries(colByKey)) {
            if (data[key] !== undefined) {
                const v = data[key];
                patch[col] = typeof v === 'string' ? v.trim() || null : null;
            }
        }
        if (Object.keys(patch).length > 0) {
            patch.updated_at = this.db.fn.now();
            const updated = await this.db('agencies').where({ id }).update(patch);
            if (updated === 0)
                return null;
        }
        return this.getBillingIdentity(id);
    }
    /** Read the agency fee schedule (cents per billing unit, by HCPCS code). */
    async getFeeSchedule(id) {
        const row = (await this.db('agencies').where({ id }).select('fee_schedule').first());
        if (!row?.fee_schedule)
            return {};
        const raw = typeof row.fee_schedule === 'string' ? JSON.parse(row.fee_schedule) : row.fee_schedule;
        const out = {};
        for (const [code, cents] of Object.entries(raw)) {
            const n = Number(cents);
            if (Number.isFinite(n) && n >= 0)
                out[code] = Math.round(n);
        }
        return out;
    }
    /** Replace the agency fee schedule. Returns the stored schedule. */
    async updateFeeSchedule(id, rates) {
        const clean = {};
        for (const [code, cents] of Object.entries(rates)) {
            const n = Number(cents);
            if (Number.isFinite(n) && n >= 0)
                clean[code] = Math.round(n);
        }
        const updated = await this.db('agencies')
            .where({ id })
            .update({
            fee_schedule: JSON.stringify(clean),
            updated_at: this.db.fn.now(),
        });
        if (updated === 0)
            return null;
        return clean;
    }
    mapRowToAgency(row) {
        return {
            id: row.id,
            name: row.name,
            state: row.state,
            operatingTracks: typeof row.operating_tracks === 'string' ? JSON.parse(row.operating_tracks) : row.operating_tracks,
            medicaidProviderNumber: row.medicaid_provider_number
        };
    }
}
//# sourceMappingURL=agency-repository.js.map