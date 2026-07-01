import type { Knex } from 'knex';
import type { UserAgencyMembership, NewUserAgencyMembership } from '../domain/user-agency.js';
export declare class UserAgencyRepository {
    private readonly db;
    constructor(db: Knex);
    /**
     * Active memberships for a user, joined with the agency name so callers can
     * render a picker without a second query. Ordered by agency name for a
     * stable list. Excludes disconnected memberships and non-approved agencies —
     * the same gates loginGate applies to the home agency.
     */
    listActiveForUser(userId: string): Promise<UserAgencyMembership[]>;
    /** One membership, regardless of status — callers decide how to gate. */
    findMembership(userId: string, agencyId: string): Promise<UserAgencyMembership | undefined>;
    create(membership: NewUserAgencyMembership): Promise<UserAgencyMembership>;
}
//# sourceMappingURL=user-agency-repository.d.ts.map