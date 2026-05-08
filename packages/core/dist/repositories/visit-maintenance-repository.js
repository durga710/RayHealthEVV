export class VisitMaintenanceRepository {
    constructor(db) {
        this.db = db;
    }
    async requestUnlock(maintenance) {
        const [inserted] = await this.db('visit_maintenance').insert({
            id: maintenance.id ?? crypto.randomUUID(),
            visit_id: maintenance.visitId,
            requester_id: maintenance.requesterId,
            reason: maintenance.reason,
            status: 'pending'
        }).returning('*');
        return this.mapRowToMaintenance(inserted);
    }
    async approveUnlock(id, adjustedTimes) {
        const [updated] = await this.db('visit_maintenance')
            .where({ id })
            .update({
            status: 'approved',
            adjusted_start_time: adjustedTimes.start,
            adjusted_end_time: adjustedTimes.end
        })
            .returning('*');
        return updated ? this.mapRowToMaintenance(updated) : null;
    }
    mapRowToMaintenance(row) {
        return {
            id: row.id,
            visitId: row.visit_id,
            requesterId: row.requester_id,
            reason: row.reason,
            status: row.status,
            adjustedStartTime: row.adjusted_start_time?.toISOString(),
            adjustedEndTime: row.adjusted_end_time?.toISOString()
        };
    }
}
//# sourceMappingURL=visit-maintenance-repository.js.map