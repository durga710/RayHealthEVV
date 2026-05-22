import { z } from 'zod';
/**
 * Per-agency feature flags. Stored as JSONB on the agencies table.
 *
 * Default for any flag is "off" — features must be explicitly enabled
 * per agency, never default-on. Plan tier governs entitlement when
 * enabling ("starter" vs "pro" gating individual features within a
 * flag is up to each feature's own UI).
 */
export declare const aiCopilotPlanSchema: z.ZodEnum<{
    off: "off";
    starter: "starter";
    pro: "pro";
}>;
export type AiCopilotPlan = z.infer<typeof aiCopilotPlanSchema>;
export declare const aiCopilotFlagSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    plan: z.ZodDefault<z.ZodEnum<{
        off: "off";
        starter: "starter";
        pro: "pro";
    }>>;
}, z.core.$strip>;
export type AiCopilotFlag = z.infer<typeof aiCopilotFlagSchema>;
export declare const notificationDigestSchema: z.ZodEnum<{
    off: "off";
    daily: "daily";
    weekly: "weekly";
}>;
export type NotificationDigest = z.infer<typeof notificationDigestSchema>;
export declare const notificationsFlagSchema: z.ZodObject<{
    coordinatorDigest: z.ZodDefault<z.ZodEnum<{
        off: "off";
        daily: "daily";
        weekly: "weekly";
    }>>;
    caregiverPush: z.ZodDefault<z.ZodBoolean>;
    caregiverEmail: z.ZodDefault<z.ZodBoolean>;
    familyEmail: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type NotificationsFlag = z.infer<typeof notificationsFlagSchema>;
export declare const agencyFeaturesSchema: z.ZodObject<{
    aiCopilot: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        plan: z.ZodDefault<z.ZodEnum<{
            off: "off";
            starter: "starter";
            pro: "pro";
        }>>;
    }, z.core.$strip>>;
    notifications: z.ZodDefault<z.ZodObject<{
        coordinatorDigest: z.ZodDefault<z.ZodEnum<{
            off: "off";
            daily: "daily";
            weekly: "weekly";
        }>>;
        caregiverPush: z.ZodDefault<z.ZodBoolean>;
        caregiverEmail: z.ZodDefault<z.ZodBoolean>;
        familyEmail: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AgencyFeatures = z.infer<typeof agencyFeaturesSchema>;
export declare const DEFAULT_AGENCY_FEATURES: AgencyFeatures;
/**
 * Parse a raw JSONB value from the database into a validated AgencyFeatures
 * object. Unknown / partial shapes are filled with defaults so existing rows
 * created before the migration still produce a valid result.
 */
export declare function parseAgencyFeatures(raw: unknown): AgencyFeatures;
//# sourceMappingURL=agency-features.d.ts.map