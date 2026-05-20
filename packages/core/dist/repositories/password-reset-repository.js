export class PasswordResetRepository {
    constructor(db) {
        this.db = db;
    }
    async create(userId, tokenHash, expiresAt) {
        await this.db('password_reset_tokens').insert({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt,
        });
    }
    async findValid(tokenHash) {
        const row = await this.db('password_reset_tokens')
            .where('token_hash', tokenHash)
            .whereNull('used_at')
            .where('expires_at', '>', new Date().toISOString())
            .first();
        if (!row)
            return null;
        return {
            id: row.id,
            userId: row.user_id,
            tokenHash: row.token_hash,
            expiresAt: row.expires_at,
            usedAt: row.used_at,
            createdAt: row.created_at,
        };
    }
    async markUsed(id) {
        await this.db('password_reset_tokens')
            .where('id', id)
            .update({ used_at: new Date().toISOString() });
    }
    /** Deletes expired tokens older than the given age in ms. Called by housekeeping. */
    async deleteExpired(olderThanMs = 24 * 60 * 60 * 1000) {
        const cutoff = new Date(Date.now() - olderThanMs).toISOString();
        await this.db('password_reset_tokens')
            .where('expires_at', '<', cutoff)
            .delete();
    }
}
//# sourceMappingURL=password-reset-repository.js.map