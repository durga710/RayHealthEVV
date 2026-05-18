import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { CaregiverRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

router.get('/', requireCapability('staff.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new CaregiverRepository(db);
    const caregivers = await repo.findByAgency(req.auth.agencyId);
    res.json({ success: true, data: caregivers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
