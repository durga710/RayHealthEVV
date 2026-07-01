function mapRow(row) {
    return {
        userId: row.user_id,
        agencyId: row.agency_id,
        agencyName: row.agency_name ?? '',
        role: row.role,
        caregiverId: row.caregiver_id ?? undefined,
        status: row.status,
        agencyReviewStatus: row.agency_review_status ?? undefined,
    };
}
export class UserAgencyRepository {
    constructor(db) {
        this.db = db;
    }
    /**
     * Active memberships for a user, joined with the agency name so callers can
     * render a picker without a second query. Ordered by agency name for a
     * stable list. Excludes disconnected memberships and non-approved agencies —
     * the same gates loginGate applies to the home agency.
     */
    async listActiveForUser(userId) {
        const rows = await this.db('user_agencies as ua')
            .join('agencies as a', 'a.id', 'ua.agency_id')
            .where('ua.user_id', userId)
            .andWhere('ua.status', 'active')
            .andWhere((qb) => {
            // review_status is R21+; older rows have NULL which means "not gated".
            void qb.whereNull('a.review_status').orWhere('a.review_status', 'approved');
        })
            .orderBy('a.name', 'asc')
            .select('ua.*', 'a.name as agency_name', 'a.review_status as agency_review_status');
        return rows.map(mapRow);
    }
    /** One membership, regardless of status — callers decide how to gate. */
    async findMembership(userId, agencyId) {
        const row = await this.db('user_agencies as ua')
            .join('agencies as a', 'a.id', 'ua.agency_id')
            .where('ua.user_id', userId)
            .andWhere('ua.agency_id', agencyId)
            .first('ua.*', 'a.name as agency_name', 'a.review_status as agency_review_status');
        return row ? mapRow(row) : undefined;
    }
    async create(membership) {
        const [row] = await this.db('user_agencies')
            .insert({
            user_id: membership.userId,
            agency_id: membership.agencyId,
            caregiver_id: membership.caregiverId ?? null,
            role: membership.role,
            status: 'active',
        })
            .returning('*');
        return mapRow(row);
    }
}
//# sourceMappingURL=user-agency-repository.js.map