import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { requireCapability } from '../middleware/require-capability.js';
import { VisitMaintenanceRepository } from '@rayhealth/core';

const router = Router();

router.post('/request-unlock', requireCapability('schedule.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new VisitMaintenanceRepository(db);
    const maintenance = await repo.requestUnlock({
      visitId: req.body.visitId,
      requesterId: req.auth.userId || 'system',
      reason: req.body.reason,
      status: 'pending',
    });
    res.status(201).json({ success: true, data: maintenance });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/approve-unlock/:id', requireCapability('schedule.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new VisitMaintenanceRepository(db);
    const maintenance = await repo.approveUnlock(req.params.id as string, req.body.adjustedTimes);
    if (!maintenance) return res.status(404).json({ success: false, error: 'Unlock request not found' });
    res.json({ success: true, data: maintenance });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/reject-unlock/:id', requireCapability('schedule.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new VisitMaintenanceRepository(db);
    const maintenance = await repo.rejectUnlock(req.params.id as string, req.body.reason);
    if (!maintenance) return res.status(404).json({ success: false, error: 'Unlock request not found' });
    res.json({ success: true, data: maintenance });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/queue', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new VisitMaintenanceRepository(db);
    const queue = await repo.getPendingQueue(req.auth.agencyId);
    res.json({ success: true, data: queue });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/history', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new VisitMaintenanceRepository(db);
    const history = await repo.getHistory(req.auth.agencyId);
    res.json({ success: true, data: history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/visit/:visitId', requireCapability('schedule.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new VisitMaintenanceRepository(db);
    const records = await repo.getByVisitId(req.params.visitId as string);
    res.json({ success: true, data: records });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;