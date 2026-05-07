import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

router.post('/', requireCapability('schedule.write'), (req, res) => {
  res.status(201).json({ id: crypto.randomUUID(), ...req.body });
});

export default router;
