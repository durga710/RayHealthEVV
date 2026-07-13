import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatMobileReleaseReadiness,
  validateMobileReleaseReadiness,
} from '../src/lib/release-readiness.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const result = validateMobileReleaseReadiness({
  app: JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')) as unknown,
  eas: JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8')) as unknown,
  store: JSON.parse(readFileSync(resolve(root, 'store.config.json'), 'utf8')) as unknown,
  apiClientSource: readFileSync(resolve(root, 'src/lib/api-client.ts'), 'utf8'),
  profileSource: readFileSync(resolve(root, 'src/features/profile/ProfileScreen.tsx'), 'utf8'),
});

process.stdout.write(`${formatMobileReleaseReadiness(result)}\n`);
if (result.errors.length > 0) process.exitCode = 1;
