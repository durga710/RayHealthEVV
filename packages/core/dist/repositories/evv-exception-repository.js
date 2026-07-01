export class EvvExceptionRepository {
    constructor(db) {
        this.db = db;
    }
    async create(exception) {
        const [row] = await this.db('evv_exceptions').insert({
            id: this.db.raw('gen_random_uuid()'),
            visit_id: exception.visitId,
            exception_type: exception.exceptionType,
            reason: exception.reason,
            approved_by: exception.approvedBy ?? null,
            approved_at: exception.approvedAt ?? null,
        }).returning('*');
        return this.mapRow(row);
    }
    // NOTE: an unscoped approve(id)/findByVisit(visitId) pair used to live here.
    // They took no agencyId and were unused, a cross-tenant footgun for the next
    // caller who wired them up. Deleted. The live, agency-scoped path is
    // ComplianceEngineRepository.acknowledgeException(agencyId, id, actorId),
    // which joins evv_exceptions -> evv_visits -> caregivers and re-checks the
    // agency. Add new exception mutations there (scoped), not here.
    mapRow(row) {
        return {
            id: row.id,
            visitId: row.visit_id,
            exceptionType: row.exception_type,
            reason: row.reason,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at instanceof Date
                ? row.approved_at.toISOString()
                : row.approved_at,
        };
    }
}
//# sourceMappingURL=evv-exception-repository.js.map