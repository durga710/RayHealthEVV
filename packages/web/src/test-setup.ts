/**
 * Global Vitest setup for @rayhealth/web (jsdom).
 *
 * jsdom does not implement IntersectionObserver / ResizeObserver / matchMedia.
 * framer-motion's `whileInView` relies on IntersectionObserver, so without a
 * polyfill any component using it (e.g. the landing RayVerify section) throws
 * on mount in tests. The IntersectionObserver stub fires an intersecting entry
 * synchronously on observe() so scroll-reveal animations resolve to their final
 * state in tests instead of staying hidden.
 */

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    const entry = {
      isIntersecting: true,
      intersectionRatio: 1,
      target,
      time: 0,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
    } as IntersectionObserverEntry;
    this.callback([entry], this);
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class MockResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
}
