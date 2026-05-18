import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['packages/web/src', 'packages/mobile/src'];
const bannedPatterns = [
  { pattern: /rayhealth_token/g, message: 'browser JWT storage key must not be present' },
  { pattern: /localStorage\.setItem\(['"]rayhealth_/g, message: 'auth state must not be persisted to localStorage' },
  { pattern: /Authorization['"]?\s*:\s*`Bearer \$\{token\}`/g, message: 'web client must not attach browser bearer tokens' }
];

function filesUnder(relativeDir: string): string[] {
  const absoluteDir = join(ROOT, relativeDir);
  return readdirSync(absoluteDir).flatMap((name) => {
    const path = join(absoluteDir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return filesUnder(path.slice(ROOT.length + 1));
    if (!/\.(ts|tsx)$/.test(path)) return [];
    if (/\.(test|spec)\.(ts|tsx)$/.test(path)) return [];
    return [path];
  });
}

const failures: string[] = [];

for (const file of SCAN_DIRS.flatMap(filesUnder)) {
  const source = readFileSync(file, 'utf8');
  for (const { pattern, message } of bannedPatterns) {
    if (pattern.test(source)) {
      failures.push(`${file}: ${message}`);
    }
    pattern.lastIndex = 0;
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Security surface scan passed');
