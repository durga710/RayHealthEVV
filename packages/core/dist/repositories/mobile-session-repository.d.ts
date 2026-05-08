import type { Knex } from 'knex';
import type { MobileSession, NewMobileSession } from '../domain/mobile-session.js';
/**
 * Server-side bookkeeping for mobile JWT auth. Each issued JWT carries a
 * `jti` claim equal to `token_jti`; auth-context middleware rejects any
 * bearer token whose jti is absent here or whose row is revoked.
 */
export declare class MobileSessionRepository {
    private readonly db;
    constructor(db: Knex);
    create(session: NewMobileSession): Promise<MobileSession>;
    findActiveByJti(jti: string, nowIso: string): Promise<MobileSession | undefined>;
    revokeByJti(jti: string, revokedAtIso: string): Promise<void>;
    revokeAllForUser(userId: string, revokedAtIso: string): Promise<void>;
}
//# sourceMappingURL=mobile-session-repository.d.ts.map