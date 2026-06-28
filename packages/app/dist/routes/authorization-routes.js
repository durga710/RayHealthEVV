import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ClientRepository, authorizationSchema, paServiceCodes } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
router.post('/', requireCapability('client.write'), async (req, res) => {
    // Validate the body. serviceCode is constrained to the canonical PA HCPCS
    // codes — previously the route inserted req.body verbatim, so an
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
    }
    catch (error) {
        safeError('POST /authorizations failed', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.get('/', requireCapability('client.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ClientRepository(db);
        const auths = await repo.getAuthorizations(req.auth.agencyId);
        res.json(auths);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=authorization-routes.js.map