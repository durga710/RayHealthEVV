export class UserRepository {
    constructor(db) {
        this.db = db;
    }
    async findByEmail(email) {
        const row = await this.db('users').where({ email: email.toLowerCase() }).first();
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