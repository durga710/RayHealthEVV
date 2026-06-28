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
export declare class AgencyRepository {
    private readonly db;
    constructor(db: Knex);
    createAgency(agency: Agency): Promise<Agency>;
    findById(id: string): Promise<Agency | null>;
    /**
     * Update an agency's mutable fields (today: just `name`). Returns the
     * updated row, or null if the agency doesn't exist. Used by the admin
     * AgencySetupPage save action — previously a stub that didn't persist.
     */
    findAll(): Promise<Agency[]>;
    findTheme(id: string): Promise<AgencyTheme | null>;
    updateName(id: string, name: string): Promise<Agency | null>;
    updateBilling(id: string, data: {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionStatus?: string;
        subscriptionTier?: string;
    }): Promise<void>;
    findByStripeCustomer(stripeCustomerId: string): Promise<Agency | null>;
    getBillingStatus(id: string): Promise<{
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        subscriptionStatus: string | null;
        subscriptionTier: string | null;
    } | null>;
    /**
     * Read the agency's billing-provider identity (the fields the 837 claim
     * needs: rendering/billing NPI, tax ID, service address, taxonomy,
     * clearinghouse + Medicaid provider numbers). All nullable until an admin
     * fills them in on the Billing & Clearinghouse setup screen.
     */
    getBillingIdentity(id: string): Promise<AgencyBillingIdentity | null>;
    /**
     * Update the agency's billing-provider identity. Only the keys present in
     * `data` are written, so admins can fill the profile incrementally. Returns
     * the full updated identity, or null if the agency doesn't exist.
     */
    updateBillingIdentity(id: string, data: Partial<AgencyBillingIdentity>): Promise<AgencyBillingIdentity | null>;
    /** Read the agency fee schedule (cents per billing unit, by HCPCS code). */
    getFeeSchedule(id: string): Promise<Record<string, number>>;
    /** Replace the agency fee schedule. Returns the stored schedule. */
    updateFeeSchedule(id: string, rates: Record<string, number>): Promise<Record<string, number> | null>;
    private mapRowToAgency;
}
//# sourceMappingURL=agency-repository.d.ts.map