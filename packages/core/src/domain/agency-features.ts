import { z } from 'zod'

/**
 * Per-agency feature flags. Stored as JSONB on the agencies table.
 *
 * Default for any flag is "off" — features must be explicitly enabled
 * per agency, never default-on. Plan tier governs entitlement when
 * enabling ("starter" vs "pro" gating individual features within a
 * flag is up to each feature's own UI).
 */

export const aiCopilotPlanSchema = z.enum(['off', 'starter', 'pro'])
export type AiCopilotPlan = z.infer<typeof aiCopilotPlanSchema>

export const aiCopilotFlagSchema = z.object({
  enabled: z.boolean().default(false),
  plan: aiCopilotPlanSchema.default('off'),
})
export type AiCopilotFlag = z.infer<typeof aiCopilotFlagSchema>

export const notificationDigestSchema = z.enum(['off', 'daily', 'weekly'])
export type NotificationDigest = z.infer<typeof notificationDigestSchema>

export const notificationsFlagSchema = z.object({
  coordinatorDigest: notificationDigestSchema.default('weekly'),
  caregiverPush: z.boolean().default(true),
  caregiverEmail: z.boolean().default(true),
  familyEmail: z.boolean().default(false),
})
export type NotificationsFlag = z.infer<typeof notificationsFlagSchema>

export const agencyFeaturesSchema = z.object({
  aiCopilot: aiCopilotFlagSchema.default({ enabled: false, plan: 'off' }),
  notifications: notificationsFlagSchema.default({
    coordinatorDigest: 'weekly',
    caregiverPush: true,
    caregiverEmail: true,
    familyEmail: false,
  }),
})
export type AgencyFeatures = z.infer<typeof agencyFeaturesSchema>

export const DEFAULT_AGENCY_FEATURES: AgencyFeatures = {
  aiCopilot: { enabled: false, plan: 'off' },
  notifications: {
    coordinatorDigest: 'weekly',
    caregiverPush: true,
    caregiverEmail: true,
    familyEmail: false,
  },
}

/**
 * Parse a raw JSONB value from the database into a validated AgencyFeatures
 * object. Unknown / partial shapes are filled with defaults so existing rows
 * created before the migration still produce a valid result.
 */
export function parseAgencyFeatures(raw: unknown): AgencyFeatures {
  // The raw value comes from JSONB and may be undefined, null, an empty
  // object, or a partial object. `agencyFeaturesSchema.parse` with defaults
  // handles all these cases — but we accept a final safety net.
  try {
    if (raw === null || raw === undefined) {
      return DEFAULT_AGENCY_FEATURES
    }
    if (typeof raw === 'string') {
      return agencyFeaturesSchema.parse(JSON.parse(raw))
    }
    return agencyFeaturesSchema.parse(raw)
  } catch {
    return DEFAULT_AGENCY_FEATURES
  }
}
