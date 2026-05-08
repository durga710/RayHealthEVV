function iso(value) {
    if (!value)
        return undefined;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function map(row) {
    return {
        id: row.id,
        userId: row.user_id,
        tokenJti: row.token_jti,
        deviceLabel: row.device_label ?? undefined,
        expiresAt: iso(row.expires_at),
        revokedAt: iso(row.revoked_at),
        createdAt: iso(row.created_at)
    };
}
/**
 * Server-side bookkeeping for mobile JWT auth. Each issued JWT carries a
 * `jti` claim equal to `token_jti`; auth-context middleware rejects any
 * bearer token whose jti is absent here or whose row is revoked.
 */
export class MobileSessionRepository {
    constructor(db) {
        this.db = db;
    }
    async create(session) {
        const [row] = await this.db('mobile_sessions')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            user_id: session.userId,
            token_jti: session.tokenJti,
            device_label: session.deviceLabel ?? null,
            expires_at: session.expiresAt,
            revoked_at: null
        })
            .returning('*');
        return map(row);
    }
    async findActiveByJti(jti, nowIso) {
        const row = await this.db('mobile_sessions')
            .where({ token_jti: jti })
            .whereNull('revoked_at')
            .where('expires_at', '>', nowIso)
            .first();
        return row ? map(row) : undefined;
    }
    async revokeByJti(jti, revokedAtIso) {
        await this.db('mobile_sessions')
            .where({ token_jti: jti })
            .whereNull('revoked_at')
            .update({ revoked_at: revokedAtIso });
    }
    async revokeAllForUser(userId, revokedAtIso) {
        await this.db('mobile_sessions')
            .where({ user_id: userId })
            .whereNull('revoked_at')
            .update({ revoked_at: revokedAtIso });
    }
}
//# sourceMappingURL=mobile-session-repository.js.map