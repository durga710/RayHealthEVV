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
