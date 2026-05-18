import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ClientRepository } from '@rayhealth/core';

const router = Router();

router.post('/', requireCapability('client.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);
    const client = await repo.createClient(req.auth.agencyId, req.body);
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/', requireCapability('client.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);
    const clients = await repo.getClients(req.auth.agencyId);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
