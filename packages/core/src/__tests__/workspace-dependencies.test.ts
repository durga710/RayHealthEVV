import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('workspace package dependencies', () => {
  it('declares root API dependencies so Vercel can bundle serverless functions', () => {
    const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(rootPackage.dependencies?.['@rayhealth/app']).toBe('file:packages/app');
    expect(rootPackage.dependencies?.['@rayhealth/core']).toBe('file:packages/core');
  });

  it('declares app to core dependency so Vercel and Turbo build packages in order', () => {
    const appPackage = JSON.parse(readFileSync(resolve(repoRoot, 'packages/app/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(appPackage.dependencies?.['@rayhealth/core']).toBe('file:../core');
  });

  it('exports built JavaScript for runtime package consumers', () => {
    const corePackage = JSON.parse(readFileSync(resolve(repoRoot, 'packages/core/package.json'), 'utf8')) as {
      exports?: {
        '.'?: { default?: string; types?: string };
        './*'?: { default?: string; types?: string };
      };
    };

    expect(corePackage.exports?.['.']?.default).toBe('./dist/index.js');
    expect(corePackage.exports?.['.']?.types).toBe('./dist/index.d.ts');
    expect(corePackage.exports?.['./*']?.default).toBe('./dist/*.js');
  });
});
