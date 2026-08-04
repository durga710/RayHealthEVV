/**
 * Device push-token registration.
 *
 * The mobile app posts its Expo push token after sign-in and whenever the
 * token rotates; it deletes the token on sign-out so a shared or returned
 * device stops receiving the previous caregiver's notifications.
 *
 * Tenancy: the token is recorded against the caller's CURRENT agency, taken
 * from the session rather than the request body. A caregiver who works at two
 * agencies registers once per agency as they switch, and each agency's sends
 * resolve only against its own row.
 */
import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { PushTokenRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

/**
 * Expo issues `ExponentPushToken[...]`, and bare FCM/APNs tokens in some
 * configurations. The format check keeps obvious junk out of the table; the
 * push service is the real authority on whether a token is deliverable.
 */
const registerSchema = z.object({
  token: z.string().min(10).max(255),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).optional(),
});

const unregisterSchema = z.object({
  token: z.string().min(10).max(255),
});

// POST /notifications/push-tokens, register or refresh this device's token
router.post('/push-tokens', requireCapability('evv.write'), async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'a valid push token is required' });
  }
  try {
    const db = req.app.get('db') as Knex;
    await new PushTokenRepository(db).register({
      agencyId: req.auth.agencyId,
      userId: req.auth.userId,
      caregiverId: req.auth.caregiverId ?? null,
      token: parsed.data.token,
      platform: parsed.data.platform ?? 'unknown',
    });
    res.json({ success: true });
  } catch (error: unknown) {
    // The token itself is a device identifier, never echoed back into logs.
    safeError('push token registration failed', error);
    res.status(500).json({ success: false, error: 'Could not register for notifications' });
  }
});

// DELETE /notifications/push-tokens, forget this device on sign-out
router.delete('/push-tokens', requireCapability('evv.write'), async (req: Request, res: Response) => {
  const parsed = unregisterSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'a valid push token is required' });
  }
  try {
    const db = req.app.get('db') as Knex;
    // Scoped to the caller's agency: signing out of agency A must not silence
    // agency B on the same device.
    await new PushTokenRepository(db).unregister(parsed.data.token, req.auth.agencyId);
    // Deleting an unknown token is not an error; sign-out should be idempotent
    // and must never block on notification bookkeeping.
    res.json({ success: true });
  } catch (error: unknown) {
    safeError('push token removal failed', error);
    res.status(500).json({ success: false, error: 'Could not update notification settings' });
  }
});

export default router;
