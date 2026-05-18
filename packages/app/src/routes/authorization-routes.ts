import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ClientRepository } from '@rayhealth/core';

const router = Router();

router.post('/', requireCapability('client.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);
    const auth = await repo.createAuthorization(req.body);
    res.status(201).json(auth);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/', requireCapability('client.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);
    const auths = await repo.getAuthorizations(req.auth.agencyId);
    res.json(auths);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
