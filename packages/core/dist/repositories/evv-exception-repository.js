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
    async approve(id, approvedBy) {
        const [row] = await this.db('evv_exceptions')
            .where({ id })
            .update({ approved_by: approvedBy, approved_at: new Date().toISOString() })
            .returning('*');
        return row ? this.mapRow(row) : undefined;
    }
    async findByVisit(visitId) {
        const rows = await this.db('evv_exceptions').where({ visit_id: visitId });
        return rows.map((r) => this.mapRow(r));
    }
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