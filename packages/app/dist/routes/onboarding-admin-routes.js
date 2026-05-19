import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { OnboardingRepository, applicantStatusValues, documentTypeValues, documentStatusValues, } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
// Role guard: admin or coordinator only
function requireAdminOrCoordinator(req, res, next) {
    const role = req.auth?.role;
    if (role !== 'admin' && role !== 'coordinator') {
        res.status(403).json({ message: 'Forbidden' });
        return;
    }
    next();
}
router.use(requireAdminOrCoordinator);
const updateStatusBodySchema = z.object({
    status: z.enum(applicantStatusValues),
    adminNotes: z.string().max(5000).optional(),
});
const requestDocumentBodySchema = z.object({
    documentType: z.enum(documentTypeValues),
});
const updateDocumentStatusBodySchema = z.object({
    status: z.enum(documentStatusValues),
});
// GET /admin/onboarding/applicants
router.get('/applicants', async (req, res) => {
    try {
        const agencyId = req.auth.agencyId;
        const statusFilter = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
        const db = req.app.get('db');
        const repo = new OnboardingRepository(db);
        const applicants = await repo.listApplicants(agencyId, statusFilter);
        res.json(applicants);
    }
    catch (error) {
        safeError('GET /admin/onboarding/applicants failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /admin/onboarding/applicants/:id
router.get('/applicants/:id', async (req, res) => {
    try {
        const agencyId = req.auth.agencyId;
        const { id } = req.params;
        const db = req.app.get('db');
        const repo = new OnboardingRepository(db);
        const applicant = await repo.findApplicantById(id, agencyId);
        if (!applicant) {
            res.status(404).json({ message: 'Applicant not found' });
            return;
        }
        const [interview, documents] = await Promise.all([
            repo.getInterviewByApplicant(id),
            repo.listDocuments(id),
        ]);
        res.json({ applicant, interview, documents });
    }
    catch (error) {
        safeError('GET /admin/onboarding/applicants/:id failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// PATCH /admin/onboarding/applicants/:id/status
router.patch('/applicants/:id/status', async (req, res) => {
    try {
        const agencyId = req.auth.agencyId;
        const { id } = req.params;
        const parse = updateStatusBodySchema.safeParse(req.body);
        if (!parse.success) {
            res.status(400).json({ message: 'Invalid request', errors: parse.error.issues });
            return;
        }
        const { status, adminNotes } = parse.data;
        const db = req.app.get('db');
        const repo = new OnboardingRepository(db);
        const updated = await repo.updateApplicantStatus(id, agencyId, status, adminNotes);
        if (!updated) {
            res.status(404).json({ message: 'Applicant not found' });
            return;
        }
        res.json(updated);
    }
    catch (error) {
        safeError('PATCH /admin/onboarding/applicants/:id/status failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /admin/onboarding/applicants/:id/hire
router.post('/applicants/:id/hire', async (req, res) => {
    try {
        const agencyId = req.auth.agencyId;
        const { id } = req.params;
        const db = req.app.get('db');
        const knex = db;
        const repo = new OnboardingRepository(db);
        const applicant = await repo.findApplicantById(id, agencyId);
        if (!applicant) {
            res.status(404).json({ message: 'Applicant not found' });
            return;
        }
        const now = new Date().toISOString();
        // Discover which caregiver columns exist (schema may vary across environments)
        const [hasFirstName, hasLastName, hasEmail, hasPhone, hasStatus, hasHiredAt] = await Promise.all([
            knex.schema.hasColumn('caregivers', 'first_name'),
            knex.schema.hasColumn('caregivers', 'last_name'),
            knex.schema.hasColumn('caregivers', 'email'),
            knex.schema.hasColumn('caregivers', 'phone'),
            knex.schema.hasColumn('caregivers', 'status'),
            knex.schema.hasColumn('caregivers', 'hired_at'),
        ]);
        const newCaregiverId = randomUUID();
        const caregiverRow = {
            id: newCaregiverId,
            agency_id: agencyId,
        };
        if (hasFirstName)
            caregiverRow.first_name = applicant.firstName;
        if (hasLastName)
            caregiverRow.last_name = applicant.lastName;
        if (hasEmail)
            caregiverRow.email = applicant.email;
        if (hasPhone && applicant.phone)
            caregiverRow.phone = applicant.phone;
        if (hasStatus)
            caregiverRow.status = 'active';
        if (hasHiredAt)
            caregiverRow.hired_at = now;
        await knex('caregivers').insert(caregiverRow);
        // Update applicant status to hired
        await repo.updateApplicantStatus(id, agencyId, 'hired');
        res.json({ success: true, caregiverId: newCaregiverId });
    }
    catch (error) {
        safeError('POST /admin/onboarding/applicants/:id/hire failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /admin/onboarding/applicants/:id/documents
router.post('/applicants/:id/documents', async (req, res) => {
    try {
        const agencyId = req.auth.agencyId;
        const { id } = req.params;
        const parse = requestDocumentBodySchema.safeParse(req.body);
        if (!parse.success) {
            res.status(400).json({ message: 'Invalid request', errors: parse.error.issues });
            return;
        }
        const { documentType } = parse.data;
        const db = req.app.get('db');
        const repo = new OnboardingRepository(db);
        // Verify applicant belongs to this agency
        const applicant = await repo.findApplicantById(id, agencyId);
        if (!applicant) {
            res.status(404).json({ message: 'Applicant not found' });
            return;
        }
        const doc = await repo.requestDocument(id, documentType);
        res.status(201).json(doc);
    }
    catch (error) {
        safeError('POST /admin/onboarding/applicants/:id/documents failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// PATCH /admin/onboarding/documents/:docId/status
router.patch('/documents/:docId/status', async (req, res) => {
    try {
        const agencyId = req.auth.agencyId;
        const { docId } = req.params;
        const parse = updateDocumentStatusBodySchema.safeParse(req.body);
        if (!parse.success) {
            res.status(400).json({ message: 'Invalid request', errors: parse.error.issues });
            return;
        }
        const { status } = parse.data;
        const db = req.app.get('db');
        const repo = new OnboardingRepository(db);
        const updated = await repo.updateDocumentStatus(docId, agencyId, status, req.auth.userId);
        if (!updated) {
            res.status(404).json({ message: 'Document not found' });
            return;
        }
        res.json(updated);
    }
    catch (error) {
        safeError('PATCH /admin/onboarding/documents/:docId/status failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
export default router;
//# sourceMappingURL=onboarding-admin-routes.js.map