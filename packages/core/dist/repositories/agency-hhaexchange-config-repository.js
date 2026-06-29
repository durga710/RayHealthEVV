/**
 * Repository for the `agency_hhaexchange_config` table.
 *
 * Stores per-agency HHAeXchange identity (Tax ID, Provider ID, timezone) plus
 * the per-caregiver and per-service mappings as JSONB. Parallel in shape to
 * the Sandata config (which doesn't have its own repo yet — reads/writes go
 * through `sandata-mapping.ts` + ad-hoc knex).
 *
 * The JSONB payloads are validated against the existing
 * `hhaexchangeCaregiverMappingSchema` / `hhaexchangeServiceMappingSchema` Zod
 * schemas exported from `services/hhaexchange-mapping.ts`. Invalid stored
 * data degrades gracefully — `readConfig()` returns the row with the bad
 * arrays replaced by empty arrays so the application can still load.
 */
import { hhaexchangeCaregiverMappingSchema, hhaexchangeServiceMappingSchema, } from '../services/hhaexchange-mapping.js';
import { encryptCell, decryptCell } from '../security/cell-cipher.js';
function parseJsonField(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
function parseCaregivers(value) {
    const raw = parseJsonField(value);
    const out = [];
    for (const item of raw) {
        const parsed = hhaexchangeCaregiverMappingSchema.safeParse(item);
        if (parsed.success)
            out.push(parsed.data);
    }
    return out;
}
function parseServices(value) {
    const raw = parseJsonField(value);
    const out = [];
    for (const item of raw) {
        const parsed = hhaexchangeServiceMappingSchema.safeParse(item);
        if (parsed.success)
            out.push(parsed.data);
    }
    return out;
}
function rowToConfig(row) {
    // The HhaexchangeConfig type requires both agencyTaxId and hhaProviderId.
    // If either is missing we return `undefined` so callers know the agency
    // isn't onboarded yet — emitting an HHAeXchange row without those would
    // be silently rejected by the aggregator.
    if (!row.agency_tax_id || !row.hha_provider_id)
        return undefined;
    return {
        agencyId: row.agency_id,
        agencyTaxId: row.agency_tax_id,
        hhaProviderId: row.hha_provider_id,
        timezone: row.timezone || 'America/New_York',
        caregivers: parseCaregivers(row.caregiver_mappings),
        services: parseServices(row.service_mappings),
        enabled: Boolean(row.enabled),
    };
}
/**
 * Repository-shaped read for the admin UI — returns the row even when
 * identity fields are missing, so the UI can show a partially-filled form.
 * Use `findValid()` when you need a config that can actually emit rows.
 */
function rowToPartial(row) {
    return {
        agencyId: row.agency_id,
        agencyTaxId: row.agency_tax_id,
        hhaProviderId: row.hha_provider_id,
        timezone: row.timezone || 'America/New_York',
        caregivers: parseCaregivers(row.caregiver_mappings),
        services: parseServices(row.service_mappings),
        enabled: Boolean(row.enabled),
        apiBaseUrl: row.api_base_url ?? null,
        hasCredentials: Boolean(row.credentials_encrypted),
    };
}
export class AgencyHhaexchangeConfigRepository {
    constructor(db) {
        this.db = db;
    }
    /** Returns the partial row (may have nullable identity fields). */
    async findByAgency(agencyId) {
        const row = (await this.db('agency_hhaexchange_config')
            .where({ agency_id: agencyId })
            .first());
        return row ? rowToPartial(row) : undefined;
    }
    /** Returns the fully-typed config only when both Tax ID and Provider ID
     * are present. Use this in the export pipeline — emitting an HHAeXchange
     * row without these fields would be rejected by the aggregator. */
    async findValid(agencyId) {
        const row = (await this.db('agency_hhaexchange_config')
            .where({ agency_id: agencyId })
            .first());
        return row ? rowToConfig(row) : undefined;
    }
    /**
     * Returns the full submission config WITH decrypted credentials — for the
     * HHAeXchange client only. Never expose this to an API response; the admin UI
     * uses `findByAgency` (which carries `hasCredentials`, not the secret).
     */
    async findSubmissionConfig(agencyId) {
        const row = (await this.db('agency_hhaexchange_config')
            .where({ agency_id: agencyId })
            .first());
        if (!row)
            return undefined;
        let credentials = null;
        if (row.credentials_encrypted) {
            const plain = decryptCell(row.credentials_encrypted);
            if (plain) {
                try {
                    credentials = JSON.parse(plain);
                }
                catch {
                    credentials = null;
                }
            }
        }
        return {
            enabled: Boolean(row.enabled),
            apiBaseUrl: row.api_base_url ?? null,
            agencyTaxId: row.agency_tax_id,
            hhaProviderId: row.hha_provider_id,
            credentials,
        };
    }
    async upsert(input) {
        const payload = {
            agency_id: input.agencyId,
            agency_tax_id: input.agencyTaxId,
            hha_provider_id: input.hhaProviderId,
            timezone: input.timezone || 'America/New_York',
            caregiver_mappings: JSON.stringify(input.caregivers ?? []),
            service_mappings: JSON.stringify(input.services ?? []),
            enabled: input.enabled,
            updated_at: this.db.fn.now(),
        };
        // Tri-state: only touch these columns when the caller supplied them, so a
        // mappings-only save never wipes a previously stored endpoint / credentials.
        if (input.apiBaseUrl !== undefined)
            payload.api_base_url = input.apiBaseUrl;
        if (input.credentials !== undefined) {
            payload.credentials_encrypted = input.credentials
                ? encryptCell(JSON.stringify(input.credentials))
                : null;
        }
        await this.db('agency_hhaexchange_config')
            .insert({ ...payload, created_at: this.db.fn.now() })
            .onConflict('agency_id')
            .merge(payload);
        const stored = await this.findByAgency(input.agencyId);
        if (!stored) {
            throw new Error(`upsert succeeded but no row found for agency=${input.agencyId}`);
        }
        return stored;
    }
}
//# sourceMappingURL=agency-hhaexchange-config-repository.js.map