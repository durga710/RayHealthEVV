import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('Vercel API function configuration', () => {
  it('routes API traffic to the Express function instead of the SPA fallback', () => {
    const config = JSON.parse(readFileSync(resolve(repoRoot, 'vercel.json'), 'utf8')) as {
      installCommand?: string;
      rewrites?: { source: string; destination: string }[];
    };
    const apiEntry = readFileSync(resolve(repoRoot, 'api/index.ts'), 'utf8');

    expect(existsSync(resolve(repoRoot, 'api/index.ts'))).toBe(true);
    expect(apiEntry).toContain("../packages/app/dist/app.js");
    expect(config.installCommand).toContain('--include-workspace-root');
    expect(config.rewrites).toContainEqual({
      source: '/api/(.*)',
      destination: '/api'
    });
  });
});
