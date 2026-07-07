/**
 * Vitest 4 enforces JS spec for `new <fn>()` — arrow functions can't be
 * invoked with `new`. Many existing route tests pass an arrow impl to
 * `vi.spyOn(core, 'XRepository').mockImplementation(() => ({ ... }))`
 * and then the route does `new core.XRepository(db).method(...)`. This
 * threw post-vitest-4 upgrade, surfacing as 500s in test responses.
 *
 * Rewriting every call site to use a regular function expression would
 * be ~16+ mechanical edits across multiple files. This setup patches
 * `vi.spyOn` once: when the mock impl is an arrow function, wrap it in
 * a regular function whose explicit return is the arrow's return value.
 * JS `new` of a regular function that returns an object yields that
 * object as the instance — restoring the pre-4 behavior without
 * touching any test source.
 *
 * Detection of arrow-vs-regular: only arrow functions lack a
 * `.prototype` property in modern JS engines.
 */
import { vi } from 'vitest';
import { MobileSessionRepository } from '@rayhealth/core';
/**
 * authContext now requires every mobile bearer token to carry a `jti` backed by
 * an active `mobile_sessions` row. The route-test suite authenticates with
 * makeToken() and mocks repositories rather than talking to a database, so we
 * stub findActiveByJti to treat any presented jti as a live, non-revoked
 * session by default. Tests that exercise revocation (missing/revoked row →
 * 401) override MobileSessionRepository via vi.spyOn, which supersedes this.
 */
MobileSessionRepository.prototype.findActiveByJti = async function stubFindActiveByJti(jti) {
    return {
        id: 'test-mobile-session',
        userId: 'test-user',
        tokenJti: jti,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
};
// Token issuance / revocation are DB writes; stub them as benign no-ops so
// login, switch-agency, logout and reset-password don't need a live database.
MobileSessionRepository.prototype.create = async function stubCreate(session) {
    return { id: 'test-mobile-session', ...session };
};
MobileSessionRepository.prototype.revokeByJti = async function stubRevokeByJti() { };
MobileSessionRepository.prototype.revokeAllForUser = async function stubRevokeAllForUser() { };
const realSpyOn = vi.spyOn.bind(vi);
vi.spyOn = function patchedSpyOn(...spyArgs) {
    const spy = realSpyOn(...spyArgs);
    const originalMockImpl = spy.mockImplementation.bind(spy);
    spy.mockImplementation = function patchedMockImpl(fn) {
        if (typeof fn === 'function' && !fn.prototype) {
            // Arrow function — wrap so `new` works.
            return originalMockImpl(function wrapped(...args) {
                return fn(...args);
            });
        }
        return originalMockImpl(fn);
    };
    return spy;
};
//# sourceMappingURL=spy-arrow-wrapper.js.map