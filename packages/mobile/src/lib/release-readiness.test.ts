import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateMobileReleaseReadiness } from './release-readiness';

const mobileRoot = fileURLToPath(new URL('../..', import.meta.url));
const app = JSON.parse(readFileSync(resolve(mobileRoot, 'app.json'), 'utf8')) as unknown;
const eas = JSON.parse(readFileSync(resolve(mobileRoot, 'eas.json'), 'utf8')) as unknown;
const apiClientSource = readFileSync(resolve(mobileRoot, 'src/lib/api-client.ts'), 'utf8');
const profileSource = readFileSync(
  resolve(mobileRoot, 'src/features/profile/ProfileScreen.tsx'),
  'utf8',
);

describe('mobile store release readiness', () => {
  it('has no committed placeholders or missing privacy/release metadata', () => {
    const result = validateMobileReleaseReadiness({ app, eas, apiClientSource, profileSource });
    expect(result.errors).toEqual([]);
  });

  it('keeps external account setup visible without treating it as source-code failure', () => {
    const result = validateMobileReleaseReadiness({ app, eas, apiClientSource, profileSource });
    expect(result.externalBlockers).toEqual(expect.arrayContaining([
      expect.stringMatching(/App Store Connect/i),
      expect.stringMatching(/Google Play/i),
    ]));
  });
});
