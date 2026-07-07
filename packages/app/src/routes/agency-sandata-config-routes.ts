/**
 * Agency Sandata config routes.
 *
 *   GET  /agencies/me/sandata-config   — read identity + mappings (nullable identity allowed)
 *   PUT  /agencies/me/sandata-config   — admin-only update
 *
 * Sibling to `agency-hhaexchange-config-routes.ts`. Validates the per-mapping
 * shapes with the existing Zod schemas from `services/sandata-mapping.ts`
 * (caregivers are UUID + external worker ID; services are HCPCS code +
 * modifier + label). Refuses `enabled=true` until provider_id is populated.
 */

import { Router, type Request, type Response } from 'express'
import type { Knex } from 'knex'
import { z } from 'zod'
import {
  AgencySandataConfigRepository,
  AuditEventRepository,
  isSafeOutboundUrl,
  sandataCaregiverMappingSchema,
  sandataServiceMappingSchema,
  type PartialSandataConfig,
} from '@rayhealth/core'
import { requireCapability } from '../middleware/require-capability.js'

const router = Router()

// Aggregator base URL must be https and must not point at a private, loopback,
// link-local or localhost target — otherwise a tenant admin could turn a
// transmission into an SSRF pivot into internal/cloud-metadata infrastructure.
const safeAggregatorUrl = z
  .string()
  .max(255)
  .refine(isSafeOutboundUrl, { message: 'apiBaseUrl must be an https URL to a public host' })

const sandataConfigUpdateSchema = z.object({
  providerId: z
    .string()
    .regex(/^\d{9}$/, 'Sandata Provider ID is 9 digits')
    .nullable()
    .optional(),
  timezone: z.string().min(1).max(64).optional(),
  caregivers: z.array(sandataCaregiverMappingSchema).optional(),
  services: z.array(sandataServiceMappingSchema).optional(),
  enabled: z.boolean().optional(),
  apiBaseUrl: safeAggregatorUrl.nullable().optional(),
  // Write-only. undefined = leave unchanged; null = clear; object = encrypt+store.
  credentials: z
    .object({
      username: z.string().max(255).optional(),
      password: z.string().max(255).optional(),
      apiKey: z.string().max(512).optional(),
      account: z.string().max(255).optional(),
    })
    .strict()
    .nullable()
    .optional(),
})

type SandataConfigUpdate = z.infer<typeof sandataConfigUpdateSchema>

function emptyPartialFor(agencyId: string): PartialSandataConfig {
  return {
    agencyId,
    providerId: null,
    timezone: 'America/New_York',
    caregivers: [],
    services: [],
    enabled: false,
    apiBaseUrl: null,
    hasCredentials: false,
  }
}

function mergeConfig(
  current: PartialSandataConfig,
  update: SandataConfigUpdate,
): PartialSandataConfig {
  return {
    agencyId: current.agencyId,
    providerId: update.providerId !== undefined ? update.providerId : current.providerId,
    timezone: update.timezone ?? current.timezone,
    caregivers: update.caregivers ?? current.caregivers,
    services: update.services ?? current.services,
    enabled: update.enabled ?? current.enabled,
    apiBaseUrl: update.apiBaseUrl !== undefined ? update.apiBaseUrl : current.apiBaseUrl,
    hasCredentials: current.hasCredentials,
  }
}

function validateForEnable(next: PartialSandataConfig): string | null {
  if (!next.enabled) return null
  if (!next.providerId) {
    return 'cannot enable: providerId is required'
  }
  return null
}

function redactForAudit(c: PartialSandataConfig): Record<string, unknown> {
  return {
    providerIdSet: Boolean(c.providerId),
    timezone: c.timezone,
    enabled: c.enabled,
    caregiverMappingCount: c.caregivers.length,
    serviceMappingCount: c.services.length,
    apiBaseUrlSet: Boolean(c.apiBaseUrl),
    hasCredentials: c.hasCredentials,
  }
}

// ---------- GET ----------

router.get(
  '/me/sandata-config',
  requireCapability('agency.read'),
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as Knex | undefined
      if (!db) {
        res.status(500).json({ success: false, error: 'database missing' })
        return
      }

      const repo = new AgencySandataConfigRepository(db)
      const stored = await repo.findByAgency(req.auth.agencyId)
      const data = stored ?? emptyPartialFor(req.auth.agencyId)
      res.json({ success: true, data })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

// ---------- PUT ----------

router.put(
  '/me/sandata-config',
  requireCapability('agency.write'),
  async (req: Request, res: Response) => {
    try {
      const parsed = sandataConfigUpdateSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'sandata-config payload failed validation',
          details: parsed.error.issues,
        })
        return
      }

      const db = req.app.get('db') as Knex | undefined
      if (!db) {
        res.status(500).json({ success: false, error: 'database missing' })
        return
      }

      const repo = new AgencySandataConfigRepository(db)
      const previous = (await repo.findByAgency(req.auth.agencyId)) ?? emptyPartialFor(req.auth.agencyId)
      const next = mergeConfig(previous, parsed.data)

      const guardError = validateForEnable(next)
      if (guardError) {
        res.status(422).json({ success: false, error: guardError })
        return
      }

      const stored = await repo.upsert({ ...next, credentials: parsed.data.credentials })

      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'agency.evv-config.changed',
          entityType: 'agency_sandata_config',
          entityId: req.auth.agencyId,
          outcome: 'success',
          payload: {
            aggregator: 'sandata',
            previous: redactForAudit(previous),
            next: redactForAudit(stored),
          },
        })
      } catch (auditErr: unknown) {
        process.stderr.write(
          `[audit-write-failed] agency.evv-config.changed (sandata) agency=${req.auth.agencyId} ` +
            `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
        )
      }

      res.json({ success: true, data: stored })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

export default router
