import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
const TEST_SECRET = 'test-secret-for-unit-tests';
export function setTestJwtSecret() {
    // Must be set before createApp() which validates JWT_SECRET at startup.
    process.env.JWT_SECRET = TEST_SECRET;
    // Auth-context bypasses the mobile_sessions DB lookup in test env so
    // tests can issue bearer tokens without provisioning a row.
    process.env.NODE_ENV = 'test';
}
export function makeToken(role, agencyId = 'agency-1', userId = 'user-1', caregiverId) {
    // jti claim is required by auth-context.ts for bearer tokens. Mint a fresh
    // UUID per call so tests don't share state.
    return jwt.sign({ sub: userId, agencyId, role, caregiverId }, TEST_SECRET, {
        expiresIn: '1h',
        jwtid: randomUUID()
    });
}
//# sourceMappingURL=test-helpers.js.map