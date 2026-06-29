import type { Knex } from 'knex';
import type { NewSession, Session } from '../domain/session.js';
export declare class SessionRepository {
    private readonly db;
    constructor(db: Knex);
    create(session: NewSession): Promise<Session>;
    findActiveByTokenHash(sessionTokenHash: string, nowIso: string): Promise<Session | undefined>;
    /** Active (non-revoked, unexpired) sessions for a user, newest first. */
    listActiveByUser(userId: string, nowIso: string): Promise<Session[]>;
    /** Revokes every active session for a user except one (e.g. the current). Returns count revoked. */
    revokeAllForUserExcept(userId: string, exceptId: string, revokedAtIso: string): Promise<number>;
    revokeById(id: string, revokedAtIso: string): Promise<void>;
    revokeByTokenHash(sessionTokenHash: string, revokedAtIso: string): Promise<void>;
    rotateCsrfToken(id: string, csrfTokenHash: string): Promise<void>;
    switchAgency(sessionId: string, agencyId: string): Promise<void>;
}
//# sourceMappingURL=session-repository.d.ts.map