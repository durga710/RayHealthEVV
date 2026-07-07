import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ClaimRepository, ClientRepository, authorizationSchema, paServiceCodes } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

const router = Router();

router.post('/', requireCapability('client.write'), async (req, res) => {
  // Validate the body. serviceCode is constrained to the canonical PA HCPCS
  // codes, previously the route inserted req.body verbatim, so an
  // authorization could be saved with a W-series program code that no EVV
  // visit or 837 claim line can ever carry, silently breaking claim matching
  // and units burn-down.
  const parsed = authorizationSchema.safeParse(req.body);
  if (!parsed.success) {
    const serviceCodeIssue = parsed.error.issues.find((i) => i.path[0] === 'serviceCode');
    res.status(400).json({
      message: serviceCodeIssue
        ? `serviceCode must be one of: ${paServiceCodes.join(', ')}`
        : 'Invalid authorization',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);

    // Guard against creating an authorization for a client in another agency.
    const inAgency = await repo.clientBelongsToAgency(parsed.data.clientId, req.auth.agencyId);
    if (!inAgency) {
      res.status(404).json({ message: 'client not found in this agency' });
      return;
    }

    const auth = await repo.createAuthorization(parsed.data);
    res.status(201).json(auth);
  } catch (error) {
    safeError('POST /authorizations failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/', requireCapability('client.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const [auths, billedUnits] = await Promise.all([
      new ClientRepository(db).getAuthorizations(req.auth.agencyId),
      new ClaimRepository(db).getBilledLineUnits(req.auth.agencyId),
    ]);
    // Enrich each authorization with units consumed by billed (non-void) claim
    // lines for the same client + service code within the auth window, the same
    // burn-down the scheduling conflict gate uses, so the two never disagree.
    const enriched = auths.map((a) => {
      const unitsUsed = billedUnits
        .filter(
          (b) =>
            b.clientId === a.clientId &&
            b.serviceCode === a.serviceCode &&
            b.serviceDate >= a.startDate &&
            b.serviceDate <= a.endDate,
        )
        .reduce((sum, b) => sum + b.units, 0);
      return {
        ...a,
        unitsUsed,
        unitsRemaining: a.unitsAuthorized - unitsUsed,
      };
    });
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/:id', requireCapability('client.write'), async (req, res) => {
  // Partial update. serviceCode, when present, is still constrained to the
  // canonical PA HCPCS set so an edit can't introduce an unbillable code.
  const parsed = authorizationSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    const serviceCodeIssue = parsed.error.issues.find((i) => i.path[0] === 'serviceCode');
    res.status(400).json({
      message: serviceCodeIssue
        ? `serviceCode must be one of: ${paServiceCodes.join(', ')}`
        : 'Invalid authorization',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);
    const updated = await repo.updateAuthorization(String(req.params.id), req.auth.agencyId, parsed.data);
    if (!updated) {
      res.status(404).json({ message: 'Authorization not found' });
      return;
    }
    res.json(updated);
  } catch (error) {
    safeError('PUT /authorizations failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.delete('/:id', requireCapability('client.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ClientRepository(db);
    const deleted = await repo.deleteAuthorization(String(req.params.id), req.auth.agencyId);
    if (!deleted) {
      res.status(404).json({ message: 'Authorization not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    safeError('DELETE /authorizations failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
