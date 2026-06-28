export class UserRepository {
    constructor(db) {
        this.db = db;
    }
    async findByEmail(email) {
        // Join agencies so the login gate (agency review status) and account
        // suspension are available without a second query. The columns are R21+;
        // older snapshots simply return undefined for them, which the caller treats
        // as "not gated".
        const row = await this.db('users as u')
            .leftJoin('agencies as a', 'a.id', 'u.agency_id')
            .where('u.email', email.toLowerCase())
            .first('u.*', 'a.review_status as agency_review_status');
        if (!row)
            return undefined;
        return {
            id: row.id,
            agencyId: row.agency_id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            caregiverId: row.caregiver_id ?? undefined,
            suspendedAt: row.suspended_at
                ? (row.suspended_at instanceof Date ? row.suspended_at.toISOString() : String(row.suspended_at))
                : null,
            agencyReviewStatus: row.agency_review_status ?? undefined,
        };
    }
    async findById(id) {
        const row = await this.db('users').where({ id }).first();
        if (!row)
            return undefined;
        return {
            id: row.id,
            agencyId: row.agency_id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            caregiverId: row.caregiver_id ?? undefined
        };
    }
    async countAll() {
        const [{ count }] = await this.db('users').count('id as count');
        return Number(count);
    }
    async create(user) {
        const [row] = await this.db('users')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: user.agencyId,
            email: user.email.toLowerCase(),
            password_hash: user.passwordHash,
            role: user.role,
            caregiver_id: user.caregiverId ?? null
        })
            .returning('*');
        return {
            id: row.id,
            agencyId: row.agency_id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            caregiverId: row.caregiver_id ?? undefined
        };
    }
}
//# sourceMappingURL=user-repository.js.map