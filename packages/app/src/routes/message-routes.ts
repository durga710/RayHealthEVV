/**
 * Agency to caregiver messaging.
 *
 * Replaces the personal text messages coordinators and caregivers were using,
 * which put work conversation (and sometimes client detail) on personal phones
 * outside any retention, audit, or BAA the agency holds.
 *
 * One thread per (agency, caregiver). A caregiver sees exactly one thread,
 * their own; staff see the agency inbox. A caregiver working at two agencies
 * has two threads and neither agency can observe the other.
 *
 * MESSAGE BODIES ARE PHI. People discuss clients here. Bodies are never put
 * into a push notification, which says only that a message arrived, and never
 * into an audit payload.
 */
import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { MessageRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { notifyCaregivers } from '../services/notification-service.js';

const router = Router();

const UUID_RE = /^[0-9a-f-]{36}$/i;

const postSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});

const staffPostSchema = postSchema.extend({
  caregiverId: z.string().uuid(),
});

// GET /messages, the caregiver's own thread, or the agency inbox for staff
router.get('/', requireCapability('evv.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new MessageRepository(db);

    if (req.auth.role === 'caregiver' && req.auth.caregiverId) {
      const thread = await repo.ensureThread(req.auth.agencyId, req.auth.caregiverId);
      const messages = await repo.listMessages(thread.id, req.auth.agencyId);
      // Opening the thread is what "read" means here.
      await repo.markRead(thread.id, req.auth.agencyId, 'caregiver');
      return res.json({ thread, messages });
    }

    const threads = await repo.listThreadsForAgency(req.auth.agencyId);
    res.json({ threads });
  } catch (error) {
    safeError('message list failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /messages/unread-count, for the mobile badge
router.get('/unread-count', requireCapability('evv.read'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.json({ count: 0 });
  }
  try {
    const db = req.app.get('db') as Knex;
    const count = await new MessageRepository(db).unreadForCaregiver(
      req.auth.caregiverId,
      req.auth.agencyId,
    );
    res.json({ count });
  } catch (error) {
    safeError('unread count failed', error);
    // A badge is not worth a failed screen; report zero and move on.
    res.json({ count: 0 });
  }
});

// GET /messages/:caregiverId, one caregiver's thread, staff view
router.get('/:caregiverId', requireCapability('staff.read'), async (req: Request, res: Response) => {
  const caregiverId = typeof req.params.caregiverId === 'string' ? req.params.caregiverId : '';
  if (!UUID_RE.test(caregiverId)) {
    return res.status(400).json({ message: 'valid caregiver id required' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new MessageRepository(db);
    // ensureThread is agency-scoped, so a caregiver id from another tenant
    // creates a thread in THIS agency that will simply never have messages,
    // rather than exposing the other agency's conversation.
    const thread = await repo.ensureThread(req.auth.agencyId, caregiverId);
    const messages = await repo.listMessages(thread.id, req.auth.agencyId);
    await repo.markRead(thread.id, req.auth.agencyId, 'staff');
    res.json({ thread, messages });
  } catch (error) {
    safeError('staff thread load failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /messages, caregiver sends to their agency
router.post('/', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Use the staff endpoint to message a caregiver' });
  }
  const parsed = postSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid message' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new MessageRepository(db);
    const thread = await repo.ensureThread(req.auth.agencyId, req.auth.caregiverId);
    const message = await repo.postMessage({
      threadId: thread.id,
      agencyId: req.auth.agencyId,
      senderType: 'caregiver',
      senderUserId: req.auth.userId,
      body: parsed.data.body,
    });
    // Sending is also reading: the caregiver has plainly seen the thread.
    await repo.markRead(thread.id, req.auth.agencyId, 'caregiver');
    res.status(201).json(message);
  } catch (error) {
    safeError('caregiver message send failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /messages/staff, staff sends to a caregiver
router.post('/staff', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const parsed = staffPostSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid message' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new MessageRepository(db);
    const thread = await repo.ensureThread(req.auth.agencyId, parsed.data.caregiverId);
    const message = await repo.postMessage({
      threadId: thread.id,
      agencyId: req.auth.agencyId,
      senderType: 'staff',
      senderUserId: req.auth.userId,
      body: parsed.data.body,
    });
    await repo.markRead(thread.id, req.auth.agencyId, 'staff');

    // The notification deliberately carries no part of the message. Bodies are
    // PHI and a push renders on a locked screen; the caregiver opens the app
    // to read it.
    void notifyCaregivers(db, {
      agencyId: req.auth.agencyId,
      caregiverIds: [parsed.data.caregiverId],
      category: 'scheduleChanges',
      title: 'New message',
      body: 'Your agency sent you a message. Open RayHealth to read it.',
      data: { kind: 'message.received', threadId: thread.id },
    });

    res.status(201).json(message);
  } catch (error) {
    safeError('staff message send failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
