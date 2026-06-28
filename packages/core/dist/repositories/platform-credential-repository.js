function mapRow(r) {
    let transports = [];
    if (typeof r.transports === 'string' && r.transports) {
        try {
            transports = JSON.parse(r.transports);
        }
        catch {
            transports = [];
        }
    }
    else if (Array.isArray(r.transports)) {
        transports = r.transports;
    }
    return {
        id: r.id,
        username: r.username,
        credentialId: r.credential_id,
        publicKey: r.public_key,
        counter: Number(r.counter ?? 0),
        transports,
        deviceLabel: r.device_label ?? null,
    };
}
export class PlatformCredentialRepository {
    constructor(db) {
        this.db = db;
    }
    async countByUsername(username) {
        const [{ c }] = await this.db('platform_admin_credentials')
            .where({ username })
            .count('id as c');
        return Number(c);
    }
    async listByUsername(username) {
        const rows = (await this.db('platform_admin_credentials')
            .where({ username })
            .orderBy('created_at', 'asc'));
        return rows.map(mapRow);
    }
    async findByCredentialId(credentialId) {
        const row = (await this.db('platform_admin_credentials')
            .where({ credential_id: credentialId })
            .first());
        return row ? mapRow(row) : undefined;
    }
    async add(input) {
        const [row] = await this.db('platform_admin_credentials')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            username: input.username,
            credential_id: input.credentialId,
            public_key: input.publicKey,
            counter: input.counter,
            transports: JSON.stringify(input.transports ?? []),
            device_label: input.deviceLabel ?? null,
        })
            .returning('id');
        return { id: row.id };
    }
    async updateCounter(credentialId, counter) {
        await this.db('platform_admin_credentials')
            .where({ credential_id: credentialId })
            .update({ counter, last_used_at: this.db.fn.now() });
    }
    async remove(id, username) {
        const n = await this.db('platform_admin_credentials').where({ id, username }).del();
        return n > 0;
    }
}
//# sourceMappingURL=platform-credential-repository.js.map