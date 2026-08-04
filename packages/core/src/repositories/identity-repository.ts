/**
 * Repository for identity consent, enrollment, and verification records.
 *
 * Every row here concerns a biometric identifier and is PHI. Reads are
 * agency-scoped, and nothing in this file returns image bytes: enrollments
 * carry an S3 object key, and the image is fetched separately by the service
 * that needs it.
 *
 * The consent gate is enforced in code (`hasActiveConsent`) rather than left
 * to policy, because state biometric statutes require consent BEFORE
 * collection and a policy nobody executes is not a defense.
 */

import type { Knex } from 'knex'

export type IdentityOutcome =
  | 'matched'
  | 'not_matched'
  | 'no_face'
  | 'not_enrolled'
  | 'error'
  | 'not_configured'
  | 'skipped'

export interface IdentityConsent {
  id: string
  caregiverId: string
  consentVersion: string
  grantedAt: string
  revokedAt: string | null
}

export interface IdentityEnrollment {
  id: string
  agencyId: string
  caregiverId: string
  referenceKey: string
  enrolledAt: string
}

function toIso(value: unknown): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

export class IdentityRepository {
  constructor(private readonly db: Knex) {}

  // ── Consent ──────────────────────────────────────────────────────────────

  /**
   * The caregiver's live consent, or null. "Live" means granted and not
   * revoked; a revoked consent is kept for the record but grants nothing.
   */
  async findActiveConsent(caregiverId: string, agencyId: string): Promise<IdentityConsent | null> {
    const row = (await this.db('identity_consents')
      .where({ caregiver_id: caregiverId, agency_id: agencyId })
      .whereNull('revoked_at')
      .orderBy('granted_at', 'desc')
      .first()) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: String(row.id),
      caregiverId: String(row.caregiver_id),
      consentVersion: String(row.consent_version),
      grantedAt: toIso(row.granted_at) ?? '',
      revokedAt: toIso(row.revoked_at),
    }
  }

  async hasActiveConsent(caregiverId: string, agencyId: string): Promise<boolean> {
    return (await this.findActiveConsent(caregiverId, agencyId)) !== null
  }

  /** Record consent verbatim, including the exact text agreed to. */
  async grantConsent(input: {
    agencyId: string
    caregiverId: string
    consentText: string
    consentVersion: string
  }): Promise<IdentityConsent> {
    const [row] = await this.db('identity_consents')
      .insert({
        agency_id: input.agencyId,
        caregiver_id: input.caregiverId,
        consent_text: input.consentText,
        consent_version: input.consentVersion,
      })
      .returning('*')
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      caregiverId: String(r.caregiver_id),
      consentVersion: String(r.consent_version),
      grantedAt: toIso(r.granted_at) ?? '',
      revokedAt: null,
    }
  }

  /**
   * Revoke consent and destroy the enrollment in one transaction.
   *
   * Revocation that left the reference face in place would be consent theatre:
   * biometric statutes require destruction, not just a flag. Returns the
   * retired enrollment's object key so the caller can delete the image itself.
   */
  async revokeConsent(caregiverId: string, agencyId: string): Promise<{ referenceKey: string | null }> {
    return this.db.transaction(async (trx) => {
      await trx('identity_consents')
        .where({ caregiver_id: caregiverId, agency_id: agencyId })
        .whereNull('revoked_at')
        .update({ revoked_at: trx.fn.now(), updated_at: trx.fn.now() })

      const enrollment = (await trx('identity_enrollments')
        .where({ caregiver_id: caregiverId, agency_id: agencyId })
        .first()) as Record<string, unknown> | undefined

      if (enrollment) {
        await trx('identity_enrollments')
          .where({ caregiver_id: caregiverId, agency_id: agencyId })
          .del()
      }
      return { referenceKey: enrollment ? String(enrollment.reference_key) : null }
    })
  }

  // ── Enrollment ───────────────────────────────────────────────────────────

  async findEnrollment(caregiverId: string, agencyId: string): Promise<IdentityEnrollment | null> {
    const row = (await this.db('identity_enrollments')
      .where({ caregiver_id: caregiverId, agency_id: agencyId })
      .whereNull('retired_at')
      .first()) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: String(row.id),
      agencyId: String(row.agency_id),
      caregiverId: String(row.caregiver_id),
      referenceKey: String(row.reference_key),
      enrolledAt: toIso(row.enrolled_at) ?? '',
    }
  }

  /**
   * Enroll or re-enroll a reference face. Returns the previous object key so
   * the caller can delete the superseded image: keeping old reference faces
   * around would grow a biometric store nobody is tracking.
   */
  async upsertEnrollment(input: {
    agencyId: string
    caregiverId: string
    referenceKey: string
  }): Promise<{ previousKey: string | null }> {
    return this.db.transaction(async (trx) => {
      const existing = (await trx('identity_enrollments')
        .where({ agency_id: input.agencyId, caregiver_id: input.caregiverId })
        .first()) as Record<string, unknown> | undefined

      await trx('identity_enrollments')
        .insert({
          agency_id: input.agencyId,
          caregiver_id: input.caregiverId,
          reference_key: input.referenceKey,
        })
        .onConflict(['agency_id', 'caregiver_id'])
        .merge({
          reference_key: input.referenceKey,
          enrolled_at: trx.fn.now(),
          retired_at: null,
          updated_at: trx.fn.now(),
        })

      return { previousKey: existing ? String(existing.reference_key) : null }
    })
  }

  // ── Verification records ─────────────────────────────────────────────────

  async recordVerification(input: {
    agencyId: string
    caregiverId: string
    visitId?: string | null
    captureKey?: string | null
    outcome: IdentityOutcome
    similarity?: number | null
    provider: string
  }): Promise<void> {
    await this.db('identity_verifications').insert({
      agency_id: input.agencyId,
      caregiver_id: input.caregiverId,
      visit_id: input.visitId ?? null,
      capture_key: input.captureKey ?? null,
      outcome: input.outcome,
      similarity: input.similarity ?? null,
      provider: input.provider,
    })
  }

  /** Stamp the outcome onto the visit for Visit Review. Tenant-scoped. */
  async markVisitIdentity(
    visitId: string,
    agencyId: string,
    outcome: IdentityOutcome,
    similarity: number | null,
  ): Promise<boolean> {
    const allowed = this.db('evv_visits as v')
      .join('caregivers as cgt', 'cgt.id', 'v.caregiver_id')
      .where('cgt.agency_id', agencyId)
      .andWhere('v.id', visitId)
      .select('v.id')

    const updated = await this.db('evv_visits')
      .whereIn('id', allowed)
      .update({ identity_outcome: outcome, identity_similarity: similarity })
    return updated > 0
  }
}
