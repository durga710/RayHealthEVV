import type { Knex } from 'knex';
interface PasswordResetToken {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    usedAt: string | null;
    createdAt: string;
}
export declare class PasswordResetRepository {
    private db;
    constructor(db: Knex);
    create(userId: string, tokenHash: string, expiresAt: string): Promise<void>;
    findValid(tokenHash: string): Promise<PasswordResetToken | null>;
    markUsed(id: string): Promise<void>;
    /** Deletes expired tokens older than the given age in ms. Called by housekeeping. */
    deleteExpired(olderThanMs?: number): Promise<void>;
}
export {};
//# sourceMappingURL=password-reset-repository.d.ts.map