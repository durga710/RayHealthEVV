import type { Knex } from 'knex';
import type { User, NewUser } from '../domain/user.js';
export declare class UserRepository {
    private readonly db;
    constructor(db: Knex);
    findByEmail(email: string): Promise<User | undefined>;
    countAll(): Promise<number>;
    create(user: NewUser): Promise<User>;
}
//# sourceMappingURL=user-repository.d.ts.map