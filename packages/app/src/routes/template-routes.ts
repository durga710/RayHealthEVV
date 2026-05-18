import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ScheduleRepository } from '@rayhealth/core';

const router = Router();

router.post('/', requireCapability('schedule.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const template = await repo.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/', requireCapability('schedule.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const templates = await repo.getTemplates(req.auth.agencyId);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
