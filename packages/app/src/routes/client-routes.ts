import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

router.post('/', requireCapability('client.write'), (req, res) => {
  res.status(201).json({ id: crypto.randomUUID(), ...req.body });
});

router.get('/', requireCapability('client.read'), (req, res) => {
  res.json([]);
});

export default router;
