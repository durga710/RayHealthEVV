export class OnboardingRepository {
    constructor(db) {
        this.db = db;
    }
    // ── Applicant methods ─────────────────────────────────────────────────
    async createApplicant(data) {
        const [row] = await this.db('applicants')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: data.agencyId,
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone ?? null,
            position: data.position ?? 'Direct Support Associate',
            cover_message: data.coverMessage ?? null,
            status: data.status ?? 'applied',
            admin_notes: data.adminNotes ?? null,
        })
            .returning('*');
        return this.mapApplicant(row);
    }
    async findApplicantById(id, agencyId) {
        const row = await this.db('applicants').where({ id, agency_id: agencyId }).first();
        return row ? this.mapApplicant(row) : null;
    }
    async listApplicants(agencyId, status) {
        let query = this.db('applicants').where({ agency_id: agencyId });
        if (status) {
            query = query.where({ status });
        }
        const rows = await query.orderBy('applied_at', 'desc');
        return rows.map((r) => this.mapApplicant(r));
    }
    async updateApplicantStatus(id, agencyId, status, adminNotes) {
        const patch = {
            status,
            updated_at: new Date().toISOString(),
        };
        if (adminNotes !== undefined) {
            patch.admin_notes = adminNotes;
        }
        const [row] = await this.db('applicants')
            .where({ id, agency_id: agencyId })
            .update(patch)
            .returning('*');
        return row ? this.mapApplicant(row) : null;
    }
    // ── Interview methods ─────────────────────────────────────────────────
    async createInterview(applicantId, sessionToken) {
        const [row] = await this.db('onboarding_interviews')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            applicant_id: applicantId,
            session_token: sessionToken,
            messages: JSON.stringify([]),
            status: 'pending',
        })
            .returning('*');
        return this.mapInterview(row);
    }
    async getInterviewByToken(token) {
        const row = await this.db('onboarding_interviews').where({ session_token: token }).first();
        return row ? this.mapInterview(row) : null;
    }
    async updateInterview(id, patch) {
        const update = {};
        if (patch.messages !== undefined)
            update.messages = JSON.stringify(patch.messages);
        if (patch.ai_summary !== undefined)
            update.ai_summary = patch.ai_summary;
        if (patch.ai_score !== undefined)
            update.ai_score = patch.ai_score;
        if (patch.status !== undefined)
            update.status = patch.status;
        if (patch.started_at !== undefined)
            update.started_at = patch.started_at;
        if (patch.completed_at !== undefined)
            update.completed_at = patch.completed_at;
        const [row] = await this.db('onboarding_interviews')
            .where({ id })
            .update(update)
            .returning('*');
        return row ? this.mapInterview(row) : null;
    }
    async getInterviewByApplicant(applicantId) {
        const row = await this.db('onboarding_interviews').where({ applicant_id: applicantId }).first();
        return row ? this.mapInterview(row) : null;
    }
    // ── Document methods ──────────────────────────────────────────────────
    async requestDocument(applicantId, documentType) {
        const [row] = await this.db('onboarding_documents')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            applicant_id: applicantId,
            document_type: documentType,
            status: 'requested',
        })
            .returning('*');
        return this.mapDocument(row);
    }
    async updateDocumentStatus(docId, agencyId, status, verifiedByUserId) {
        const patch = { status };
        if (status === 'verified') {
            patch.verified_at = new Date().toISOString();
            if (verifiedByUserId)
                patch.verified_by_user_id = verifiedByUserId;
        }
        if (status === 'submitted') {
            patch.submitted_at = new Date().toISOString();
        }
        // Tenant-scope via join through applicants — only update if doc belongs to this agency
        const [row] = await this.db('onboarding_documents as od')
            .join('applicants as a', 'a.id', 'od.applicant_id')
            .where('od.id', docId)
            .where('a.agency_id', agencyId)
            .update(patch)
            .returning('od.*');
        return row ? this.mapDocument(row) : null;
    }
    async listDocuments(applicantId) {
        const rows = await this.db('onboarding_documents')
            .where({ applicant_id: applicantId })
            .orderBy('requested_at', 'asc');
        return rows.map((r) => this.mapDocument(r));
    }
    // ── Private mappers ───────────────────────────────────────────────────
    mapApplicant(row) {
        return {
            id: row.id,
            agencyId: row.agency_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone ?? undefined,
            position: row.position,
            coverMessage: row.cover_message ?? undefined,
            status: row.status,
            appliedAt: row.applied_at instanceof Date
                ? row.applied_at.toISOString()
                : row.applied_at,
            updatedAt: row.updated_at instanceof Date
                ? row.updated_at.toISOString()
                : row.updated_at,
            adminNotes: row.admin_notes ?? undefined,
        };
    }
    mapInterview(row) {
        let messages = [];
        try {
            const raw = row.messages;
            if (typeof raw === 'string') {
                messages = JSON.parse(raw);
            }
            else if (Array.isArray(raw)) {
                messages = raw;
            }
        }
        catch {
            messages = [];
        }
        return {
            id: row.id,
            applicantId: row.applicant_id,
            sessionToken: row.session_token,
            messages,
            aiSummary: row.ai_summary ?? undefined,
            aiScore: row.ai_score ?? undefined,
            status: row.status,
            startedAt: row.started_at instanceof Date
                ? row.started_at.toISOString()
                : row.started_at ?? undefined,
            completedAt: row.completed_at instanceof Date
                ? row.completed_at.toISOString()
                : row.completed_at ?? undefined,
            createdAt: row.created_at instanceof Date
                ? row.created_at.toISOString()
                : row.created_at ?? undefined,
        };
    }
    mapDocument(row) {
        return {
            id: row.id,
            applicantId: row.applicant_id,
            documentType: row.document_type,
            status: row.status,
            notes: row.notes ?? undefined,
            requestedAt: row.requested_at instanceof Date
                ? row.requested_at.toISOString()
                : row.requested_at ?? undefined,
            submittedAt: row.submitted_at instanceof Date
                ? row.submitted_at.toISOString()
                : row.submitted_at ?? undefined,
            verifiedAt: row.verified_at instanceof Date
                ? row.verified_at.toISOString()
                : row.verified_at ?? undefined,
            verifiedByUserId: row.verified_by_user_id ?? undefined,
            createdAt: row.created_at instanceof Date
                ? row.created_at.toISOString()
                : row.created_at ?? undefined,
        };
    }
}
//# sourceMappingURL=onboarding-repository.js.map