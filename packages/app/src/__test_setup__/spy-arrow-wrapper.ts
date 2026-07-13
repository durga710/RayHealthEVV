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
import { beforeEach, vi } from 'vitest';
import { MobileSessionRepository } from '@rayhealth/core';

const realSpyOn = vi.spyOn.bind(vi);
(vi as unknown as { spyOn: (...a: unknown[]) => unknown }).spyOn = function patchedSpyOn(
  this: unknown,
  ...spyArgs: unknown[]
) {
  const spy = realSpyOn(...(spyArgs as Parameters<typeof realSpyOn>)) as unknown as {
    mockImplementation: (fn: (...args: unknown[]) => unknown) => unknown;
  };
  const originalMockImpl = spy.mockImplementation.bind(spy);
  spy.mockImplementation = function patchedMockImpl(fn: (...args: unknown[]) => unknown) {
    if (typeof fn === 'function' && !fn.prototype) {
      // Arrow function — wrap so `new` works.
      return originalMockImpl(function wrapped(this: unknown, ...args: unknown[]) {
        return fn(...args);
      });
    }
    return originalMockImpl(fn);
  };
  return spy;
} as unknown as typeof vi.spyOn;

// Route tests use signed bearer tokens without a database. Model an active
// mobile-session row by default so auth middleware exercises the same jti
// lookup as production. Security-specific tests override this result to cover
// missing and revoked sessions.
beforeEach(() => {
  vi.spyOn(MobileSessionRepository.prototype, 'findActiveByJti').mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000098',
    userId: 'user-1',
    tokenJti: '00000000-0000-4000-8000-000000000099',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-07-12T00:00:00.000Z',
  });
});
