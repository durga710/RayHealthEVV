/**
 * Caregiver invite routes.
 *
 *   POST /invites                 — create invite + send email
 *   POST /invites/:id/resend      — resend email for an existing pending invite
 *   POST /invites/:id/revoke      — mark invite revoked
 *   GET  /invites                 — list invites for the agency (admin/coordinator)
 *
 * Acceptance flow (caregiver clicks the link in the email):
 *   GET  /invites/accept/:token   — public, returns invite info for the
 *                                   acceptance page in the mobile/web app
 *   POST /invites/accept/:token   — public, takes { accessCode, password,
 *                                   firstName, lastName } and creates the
 *                                   caregiver + user records
 *
 * Per the brand memory: invitation-only signup, emailed invite + access code,
 * admin resend/revoke/copy-link controls, private acceptance flow.
 */

import { Router, type Request, type Response } from 'express'
import { randomBytes, randomInt } from 'node:crypto'
import type { Knex } from 'knex'
import { AuditEventRepository } from '@rayhealth/core'
import { requireCapability } from '../middleware/require-capability.js'
import {
  EmailNotConfiguredError,
  EmailSendError,
  isEmailConfigured,
  sendEmail,
} from '../services/email-client.js'

const router = Router()

// ----- Helpers -----

/** Generate a 16-char alphanumeric token used in the magic-link URL. */
function generateToken(): string {
  // 32 hex chars from 16 random bytes — URL-safe and unguessable.
  return randomBytes(16).toString('hex')
}

/** Short human-friendly access code: 8 chars, A-Z + 2-9 (no 0/O/1/I confusion). */
function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    // randomInt draws from a cryptographically secure source with rejection
    // sampling, so the distribution stays uniform regardless of alphabet size
    // (plain `byte % len` biases toward lower indices unless len divides 256).
    code += alphabet[randomInt(alphabet.length)]
  }
  // Insert a dash for legibility: XXXX-XXXX
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'https://rayhealthevv.com'
}

interface InviteRow {
  id: string
  agency_id: string
  email: string
  role: string
  status: string
  invited_by: string
  expires_at: Date | string
  token: string
  access_code: string
  accepted_at: Date | string | null
  last_sent_at: Date | string | null
  first_name: string | null
  last_name: string | null
  created_at?: Date | string
}

interface InvitePublic {
  id: string
  agencyId: string
  email: string
  role: string
  status: string
  firstName: string | null
  lastName: string | null
  expiresAt: string
  acceptedAt: string | null
  lastSentAt: string | null
  createdAt: string | null
  /** The acceptance link — included in response so the admin UI can show a Copy button. */
  acceptanceUrl: string
}

function toPublic(row: InviteRow): InvitePublic {
  return {
    id: row.id,
    agencyId: row.agency_id,
    email: row.email,
    role: row.role,
    status: row.status,
    firstName: row.first_name,
    lastName: row.last_name,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : row.expires_at.toISOString(),
    acceptedAt: row.accepted_at
      ? typeof row.accepted_at === 'string'
        ? row.accepted_at
        : row.accepted_at.toISOString()
      : null,
    lastSentAt: row.last_sent_at
      ? typeof row.last_sent_at === 'string'
        ? row.last_sent_at
        : row.last_sent_at.toISOString()
      : null,
    createdAt: row.created_at
      ? typeof row.created_at === 'string'
        ? row.created_at
        : row.created_at.toISOString()
      : null,
    acceptanceUrl: `${getAppBaseUrl()}/accept/${row.token}`,
  }
}

interface SendInviteEmailOptions {
  to: string
  firstName: string | null
  agencyName: string
  acceptanceUrl: string
  accessCode: string
  expiresAt: Date
}

async function sendInviteEmail(opts: SendInviteEmailOptions): Promise<string | null> {
  if (!isEmailConfigured()) {
    process.stderr.write(
      '[invite-email] RESEND_API_KEY or RESEND_FROM_ADDRESS not set; invite created but email skipped\n',
    )
    return null
  }

  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi,'
  const subject = `You're invited to join ${opts.agencyName} on RayHealth`
  const text = [
    greeting,
    '',
    `You've been invited to join ${opts.agencyName} as a caregiver on RayHealth EVV.`,
    '',
    'To accept your invitation:',
    `  1. Open this link:  ${opts.acceptanceUrl}`,
    `  2. Enter your access code:  ${opts.accessCode}`,
    `  3. Set your password and complete your profile`,
    '',
    `The invitation expires ${opts.expiresAt.toLocaleDateString()}.`,
    '',
    'If you weren\'t expecting this email, you can ignore it.',
    '',
    '— RayHealth EVV',
  ].join('\n')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0b1220; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #0B5FB1;">You're invited to ${escapeHtml(opts.agencyName)}</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>You've been invited to join <strong>${escapeHtml(opts.agencyName)}</strong> as a caregiver on RayHealth EVV.</p>
      <p style="margin: 1.5rem 0;">
        <a href="${escapeHtml(opts.acceptanceUrl)}"
           style="background:#0B5FB1;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          Accept invitation
        </a>
      </p>
      <p>Your access code:</p>
      <p style="font-family: 'SF Mono', Menlo, monospace; font-size: 20px; padding: 12px; background: #f1f5f9; border-radius: 6px; letter-spacing: 2px;">
        <strong>${escapeHtml(opts.accessCode)}</strong>
      </p>
      <p style="color: #64748b; font-size: 14px;">
        Expires ${escapeHtml(opts.expiresAt.toLocaleDateString())}. If you weren't expecting this email, you can ignore it.
      </p>
      <p style="color: #94a3b8; font-size: 12px;">— RayHealth EVV</p>
    </div>
  `

  try {
    const result = await sendEmail({
      to: opts.to,
      subject,
      text,
      html,
      tags: [
        { name: 'kind', value: 'invite' },
        { name: 'agency', value: opts.agencyName.slice(0, 32) },
      ],
    })
    return result.id
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      // Already logged above; swallow so the invite still persists.
      return null
    }
    if (err instanceof EmailSendError) {
      process.stderr.write(`[invite-email] Resend failed: ${err.status} ${err.message}\n`)
      return null
    }
    throw err
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ----- POST /invites -----

router.post('/', requireCapability('staff.write'), async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      email?: string
      role?: string
      firstName?: string
      lastName?: string
    }
    const email = (body.email ?? '').trim().toLowerCase()
    const role = body.role ?? 'caregiver'
    // Bound the length before the regex: 254 is the RFC 5321 maximum, and the
    // cap keeps the validation pattern from backtracking on pathological input.
    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'valid email is required' })
      return
    }
    if (!['caregiver', 'coordinator', 'admin', 'family'].includes(role)) {
      res.status(400).json({ success: false, error: 'invalid role' })
      return
    }

    const db = req.app.get('db') as Knex
    const token = generateToken()
    const accessCode = generateAccessCode()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 14 * 86400000) // 14-day expiry

    // Look up agency name for the email copy. Best-effort — if it fails we
    // fall back to "your agency".
    let agencyName = 'your agency'
    try {
      const agencyRow = (await db('agencies')
        .where({ id: req.auth.agencyId })
        .first('name')) as { name?: string } | undefined
      if (agencyRow?.name) agencyName = agencyRow.name
    } catch {
      /* fall through */
    }

    const [row] = (await db('staff_invites')
      .insert({
        id: db.raw('gen_random_uuid()'),
        agency_id: req.auth.agencyId,
        email,
        role,
        status: 'pending',
        invited_by: req.auth.userId,
        expires_at: expiresAt,
        token,
        access_code: accessCode,
        first_name: body.firstName?.trim() || null,
        last_name: body.lastName?.trim() || null,
      })
      .returning('*')) as InviteRow[]

    const inviteId = await sendInviteEmail({
      to: email,
      firstName: row.first_name,
      agencyName,
      acceptanceUrl: `${getAppBaseUrl()}/accept/${token}`,
      accessCode,
      expiresAt,
    })

    if (inviteId) {
      await db('staff_invites').where({ id: row.id }).update({ last_sent_at: now })
      row.last_sent_at = now
    }

    // Audit the invite creation. Hash the email to keep the table clean of
    // raw addresses — the invite id + audit row connect to the recipient if
    // needed for an investigation.
    try {
      const auditRepo = new AuditEventRepository(db)
      await auditRepo.create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'invite.created',
        entityType: 'staff_invite',
        entityId: row.id,
        outcome: inviteId ? 'success' : 'failure',
        payload: {
          role,
          emailSent: Boolean(inviteId),
          resendMessageId: inviteId,
          expiresAt: expiresAt.toISOString(),
        },
      })
    } catch (auditErr: unknown) {
      process.stderr.write(
        `[audit-write-failed] invite.created err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.status(201).json({ success: true, data: toPublic(row), emailSent: Boolean(inviteId) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ----- POST /invites/:id/resend -----

router.post('/:id/resend', requireCapability('staff.write'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'invite id required' })
      return
    }
    const db = req.app.get('db') as Knex
    const row = (await db('staff_invites')
      .where({ id, agency_id: req.auth.agencyId })
      .first()) as InviteRow | undefined
    if (!row) {
      res.status(404).json({ success: false, error: 'invite not found' })
      return
    }
    if (row.status !== 'pending') {
      res.status(409).json({ success: false, error: `invite is ${row.status}, cannot resend` })
      return
    }

    let agencyName = 'your agency'
    try {
      const agencyRow = (await db('agencies')
        .where({ id: req.auth.agencyId })
        .first('name')) as { name?: string } | undefined
      if (agencyRow?.name) agencyName = agencyRow.name
    } catch { /* */ }

    const messageId = await sendInviteEmail({
      to: row.email,
      firstName: row.first_name,
      agencyName,
      acceptanceUrl: `${getAppBaseUrl()}/accept/${row.token}`,
      accessCode: row.access_code,
      expiresAt: typeof row.expires_at === 'string' ? new Date(row.expires_at) : row.expires_at,
    })

    const now = new Date()
    if (messageId) {
      await db('staff_invites').where({ id: row.id }).update({ last_sent_at: now })
      row.last_sent_at = now
    }

    try {
      const auditRepo = new AuditEventRepository(db)
      await auditRepo.create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'invite.resent',
        entityType: 'staff_invite',
        entityId: row.id,
        outcome: messageId ? 'success' : 'failure',
        payload: { resendMessageId: messageId },
      })
    } catch (auditErr: unknown) {
      process.stderr.write(
        `[audit-write-failed] invite.resent err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.json({ success: true, data: toPublic(row), emailSent: Boolean(messageId) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ----- POST /invites/:id/revoke -----

router.post('/:id/revoke', requireCapability('staff.write'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'invite id required' })
      return
    }
    const db = req.app.get('db') as Knex
    const updated = await db('staff_invites')
      .where({ id, agency_id: req.auth.agencyId, status: 'pending' })
      .update({ status: 'revoked' })

    if (updated === 0) {
      res.status(404).json({ success: false, error: 'invite not found or already resolved' })
      return
    }

    try {
      const auditRepo = new AuditEventRepository(db)
      await auditRepo.create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'invite.revoked',
        entityType: 'staff_invite',
        entityId: id,
        outcome: 'success',
        payload: {},
      })
    } catch { /* */ }

    res.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ----- GET /invites -----

router.get('/', requireCapability('staff.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex
    const rows = (await db('staff_invites')
      .where({ agency_id: req.auth.agencyId })
      .orderBy('created_at', 'desc')) as InviteRow[]
    res.json({ success: true, data: rows.map(toPublic) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

export default router
