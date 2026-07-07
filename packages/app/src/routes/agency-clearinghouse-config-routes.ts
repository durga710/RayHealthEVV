/**
 * Agency clearinghouse config routes.
 *
 *   GET  /agencies/me/clearinghouse-config , read transport/endpoint/settings + hasCredentials
 *   PUT  /agencies/me/clearinghouse-config , admin-only update (write-only credentials)
 *
 * Sibling to the Sandata / HHAeXchange config routes. Credentials are stored
 * AES-256-GCM encrypted by the repository and never returned to the client.
 */

import { Router, type Request, type Response } from 'express'
import type { Knex } from 'knex'
import { z } from 'zod'
import {
  AgencyClearinghouseConfigRepository,
  AuditEventRepository,
  type PartialClearinghouseConfig,
} from '@rayhealth/core'
import { requireCapability } from '../middleware/require-capability.js'

const router = Router()

const clearinghouseConfigUpdateSchema = z.object({
  transport: z.enum(['sftp', 'http']).optional(),
  endpoint: z.string().max(255).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
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

type ClearinghouseConfigUpdate = z.infer<typeof clearinghouseConfigUpdateSchema>

function emptyPartialFor(agencyId: string): PartialClearinghouseConfig {
  return {
    agencyId,
    transport: 'sftp',
    endpoint: null,
    settings: {},
    enabled: false,
    hasCredentials: false,
  }
}

function mergeConfig(current: PartialClearinghouseConfig, update: ClearinghouseConfigUpdate): PartialClearinghouseConfig {
  return {
    agencyId: current.agencyId,
    transport: update.transport ?? current.transport,
    endpoint: update.endpoint !== undefined ? update.endpoint : current.endpoint,
    settings: update.settings ?? current.settings,
    enabled: update.enabled ?? current.enabled,
    hasCredentials: current.hasCredentials,
  }
}

function validateForEnable(next: PartialClearinghouseConfig): string | null {
  if (!next.enabled) return null
  if (!next.endpoint) return 'cannot enable: endpoint is required'
  return null
}

function redactForAudit(c: PartialClearinghouseConfig): Record<string, unknown> {
  return {
    transport: c.transport,
    endpointSet: Boolean(c.endpoint),
    enabled: c.enabled,
    hasCredentials: c.hasCredentials,
    settingKeys: Object.keys(c.settings ?? {}).length,
  }
}

router.get('/me/clearinghouse-config', requireCapability('agency.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex | undefined
    if (!db) {
      res.status(500).json({ success: false, error: 'database missing' })
      return
    }
    const stored = await new AgencyClearinghouseConfigRepository(db).findByAgency(req.auth.agencyId)
    res.json({ success: true, data: stored ?? emptyPartialFor(req.auth.agencyId) })
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'unexpected error' })
  }
})

router.put('/me/clearinghouse-config', requireCapability('agency.write'), async (req: Request, res: Response) => {
  try {
    const parsed = clearinghouseConfigUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'clearinghouse-config payload failed validation', details: parsed.error.issues })
      return
    }
    const db = req.app.get('db') as Knex | undefined
    if (!db) {
      res.status(500).json({ success: false, error: 'database missing' })
      return
    }

    const repo = new AgencyClearinghouseConfigRepository(db)
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
        entityType: 'agency_clearinghouse_config',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: { aggregator: 'clearinghouse', previous: redactForAudit(previous), next: redactForAudit(stored) },
      })
    } catch (auditErr: unknown) {
      process.stderr.write(
        `[audit-write-failed] agency.evv-config.changed (clearinghouse) agency=${req.auth.agencyId} ` +
          `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.json({ success: true, data: stored })
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'unexpected error' })
  }
})

export default router
