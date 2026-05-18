import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('deployment ignore configuration', () => {
  it('keeps generated artifacts out of Vercel source uploads', () => {
    const vercelIgnore = readFileSync(resolve(repoRoot, '.vercelignore'), 'utf8');

    expect(vercelIgnore).toContain('.turbo');
    expect(vercelIgnore).toContain('packages/*/dist');
    expect(vercelIgnore).toContain('packages/mobile/.expo');
    expect(vercelIgnore).toContain('*.tsbuildinfo');
  });
});
