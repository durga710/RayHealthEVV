import type { Knex } from 'knex';
/**
 * WebAuthn (passkey) credentials for the platform super-admin's second factor.
 * Stores only the public key + signature counter — never biometric data. Keyed
 * by `username` (the env SUPER_ADMIN_USERNAME) because the super-admin is not a
 * `users` row.
 */
export interface PlatformCredential {
    id: string;
    username: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string[];
    deviceLabel: string | null;
}
interface NewPlatformCredential {
    username: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports?: string[];
    deviceLabel?: string | null;
}
export declare class PlatformCredentialRepository {
    private readonly db;
    constructor(db: Knex);
    countByUsername(username: string): Promise<number>;
    listByUsername(username: string): Promise<PlatformCredential[]>;
    findByCredentialId(credentialId: string): Promise<PlatformCredential | undefined>;
    add(input: NewPlatformCredential): Promise<{
        id: string;
    }>;
    updateCounter(credentialId: string, counter: number): Promise<void>;
    remove(id: string, username: string): Promise<boolean>;
}
export {};
//# sourceMappingURL=platform-credential-repository.d.ts.map