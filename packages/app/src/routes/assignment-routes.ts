import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

router.post('/', requireCapability('schedule.write'), async (req, res) => {
  // In a real app, this would use assignment service and persist to DB
  res.status(201).json({ id: crypto.randomUUID(), ...req.body });
});

export default router;
