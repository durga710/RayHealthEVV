/**
 * Guards the invariants that keep the web app readable under any agency's
 * color scheme.
 *
 * Every rule here exists because the corresponding bug actually shipped. The
 * headline one: `button { background: var(--gradient-brand) }` sets a
 * background-IMAGE, and `.btn-ghost { background-color: transparent }` , a
 * longhand , cannot clear an image. So every ghost button in the admin app
 * rendered brand-colored text on the brand gradient, i.e. invisible. Nothing in
 * lint, typecheck, or the unit tests could see it.
 *
 * Run: npm run css:scan
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const STYLESHEET = 'packages/web/src/index.css';
const RESOLVER = 'packages/core/src/domain/theme-resolver.ts';
const TSX_DIRS = ['packages/web/src'];

const failures: string[] = [];

function repoPath(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

function fail(file: string, line: number, message: string): void {
  failures.push(`${file}:${line}: ${message}`);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/**
 * Blank out comments while preserving every byte offset, so the rules below
 * never fire on prose. A rule that bans an idiom has to describe it, and a
 * scanner that flags its own documentation is a scanner people switch off.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (match, prefix: string) => prefix + ' '.repeat(match.length - prefix.length));
}

function sourceFiles(relativeDir: string): string[] {
  const absoluteDir = join(ROOT, relativeDir);
  return readdirSync(absoluteDir).flatMap((name) => {
    const path = join(absoluteDir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path.slice(ROOT.length + 1));
    if (!/\.tsx?$/.test(path)) return [];
    if (/\.(test|spec)\.tsx?$/.test(path)) return [];
    return [path];
  });
}

const css = withoutComments(readFileSync(join(ROOT, STYLESHEET), 'utf8'));
const rootBlock = /:root\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';
if (!rootBlock) {
  fail(STYLESHEET, 1, 'no :root token block found; the rest of this scan cannot run');
}

interface Rule {
  selector: string;
  body: string;
  line: number;
}

const rules: Rule[] = [];
for (const match of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
  rules.push({
    selector: match[1].trim(),
    body: match[2],
    line: lineOf(css, match.index ?? 0),
  });
}

const declaresImage = (body: string): boolean =>
  /background-image:/.test(body) || /background:\s*(linear-|radial-|conic-|url\()/.test(body);

// ---------------------------------------------------------------------------
// Rule 1: the shorthand/longhand trap.
// ---------------------------------------------------------------------------
// `background-color` only replaces the color layer. If ANY lower-specificity
// rule paints an image on the same element, that image keeps rendering on top
// of the fill you asked for. A rule that declares its own image is stating its
// full intent and is fine; a rule that does not must use the `background`
// shorthand, which resets the image layer.
for (const rule of rules) {
  if (rule.selector.includes(':root')) continue;
  if (!/background-color:/.test(rule.body)) continue;
  if (declaresImage(rule.body)) continue;
  fail(
    STYLESHEET,
    rule.line,
    `\`${rule.selector.replace(/\s+/g, ' ')}\` sets the background-color longhand without declaring its own ` +
      'background-image. A longhand cannot clear an inherited image, so the fill you asked for may never ' +
      'render. Use the `background` shorthand.'
  );
}

// ---------------------------------------------------------------------------
// Rule 2: no raw color literals outside the token block.
// ---------------------------------------------------------------------------
// design-system.test.ts already bans hex in .tsx. The stylesheet itself was
// exempt, which is how ~27 stray values and one orphaned lavender accumulated
// in colors no agency theme could ever reach.
for (const rule of rules) {
  if (rule.selector.includes(':root')) continue;
  for (const hex of rule.body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    fail(
      STYLESHEET,
      rule.line + lineOf(rule.body, hex.index ?? 0) - 1,
      `raw color literal ${hex[0]} outside :root. Define a token so it can follow an agency theme.`
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 3: white and black are tokens too.
// ---------------------------------------------------------------------------
// `color: white` on a brand-filled surface is an assumption that the brand is
// dark. --color-on-brand is chosen by measured contrast instead.
for (const rule of rules) {
  if (rule.selector.includes(':root')) continue;
  const match = /(?:^|[;{\s])color:\s*(white|black)\s*[;}]/.exec(rule.body);
  if (match) {
    fail(
      STYLESHEET,
      rule.line,
      `\`${rule.selector.replace(/\s+/g, ' ')}\` hardcodes \`color: ${match[1]}\`. Use --color-on-brand ` +
        '(brand surfaces), --color-text-on-dark (dark panels), or --color-text.'
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 4: every token referenced anywhere is defined in :root.
// ---------------------------------------------------------------------------
const definedTokens = new Set(
  [...rootBlock.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])
);

const tsxFiles = TSX_DIRS.flatMap(sourceFiles);
const scopedPrefixes = ['--rh-', '--mk-', '--pub-'];
// Page-scoped design systems (LandingPage, SiteLayout, public-brand) define
// their own variables inside <style> blocks; only global tokens are checked.
const isGlobalToken = (token: string): boolean =>
  token.startsWith('--color-') || token.startsWith('--gradient-') ||
  token.startsWith('--shadow-') || token.startsWith('--font-') ||
  token.startsWith('--space-') || token.startsWith('--radius-') ||
  token.startsWith('--focus-');

for (const [file, source] of [
  [STYLESHEET, css] as const,
  ...tsxFiles.map((path) => [repoPath(path), withoutComments(readFileSync(path, 'utf8'))] as const),
]) {
  for (const use of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const token = use[1];
    if (scopedPrefixes.some((prefix) => token.startsWith(prefix))) continue;
    if (!isGlobalToken(token)) continue;
    if (definedTokens.has(token)) continue;
    if (new RegExp(`${token}\\s*:`).test(source)) continue; // defined locally in the same file
    fail(file, lineOf(source, use.index ?? 0), `var(${token}) is not defined in the :root token block.`);
  }
}

// ---------------------------------------------------------------------------
// Rule 5: the resolver and the stylesheet cannot drift apart.
// ---------------------------------------------------------------------------
// This is the rule that permanently closes the original hole. --color-on-brand
// existed in :root but was not in the override list, so it stayed white forever
// no matter what an agency picked. Any token whose default is derived from the
// brand MUST be resolver-managed, and vice versa.
const resolverSource = withoutComments(readFileSync(join(ROOT, RESOLVER), 'utf8'));
const listBlock = /AGENCY_THEME_VARIABLES[^=]*=\s*\[([\s\S]*?)\]/.exec(resolverSource)?.[1] ?? '';
const managed = new Set([...listBlock.matchAll(/'(--[\w-]+)'/g)].map((match) => match[1]));

if (managed.size === 0) {
  fail(RESOLVER, 1, 'could not read AGENCY_THEME_VARIABLES; rule 5 cannot run');
}

for (const token of managed) {
  if (!definedTokens.has(token)) {
    fail(
      STYLESHEET,
      1,
      `${token} is managed by the theme resolver but has no static default in :root. ` +
        'Agencies with no theme would get nothing.'
    );
  }
}

// Any :root token whose VALUE mentions a brand color is brand-derived, so it
// has to be overridable.
for (const declaration of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  const [, token, value] = declaration;
  const derivesFromBrand = /var\(\s*--color-(primary|accent|brand-raw)/.test(value);
  if (derivesFromBrand && !managed.has(token)) {
    fail(
      STYLESHEET,
      lineOf(css, declaration.index ?? 0),
      `${token} is derived from the brand color but is not in AGENCY_THEME_VARIABLES, so it would keep ` +
        'the RayHealth default when an agency theme is applied.'
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 6: --color-brand-raw is never allowed to carry text.
// ---------------------------------------------------------------------------
// It deliberately holds the agency's UNADJUSTED color, which may fail AA. It is
// for logo marks and decorative washes only.
for (const [file, source] of [
  [STYLESHEET, css] as const,
  ...tsxFiles.map((path) => [repoPath(path), withoutComments(readFileSync(path, 'utf8'))] as const),
]) {
  for (const use of source.matchAll(/(^|[^-\w])color\s*:\s*['"`]?\s*var\(\s*--color-brand-raw/gm)) {
    fail(
      file,
      lineOf(source, use.index ?? 0),
      '--color-brand-raw is the agency color BEFORE contrast adjustment and may be unreadable. ' +
        'Use --color-primary for anything that carries text.'
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 7: no alpha byte appended to a token.
// ---------------------------------------------------------------------------
// `` `${RISK_COLOR[level]}14` `` yields the literal string "var(--color-accent)14",
// an invalid declaration the browser silently drops. The element loses its
// background and its colored text lands on whatever is underneath.
for (const path of tsxFiles) {
  const source = withoutComments(readFileSync(path, 'utf8'));
  for (const use of source.matchAll(/\$\{[^}]+\}[0-9a-fA-F]{2}`/g)) {
    fail(
      repoPath(path),
      lineOf(source, use.index ?? 0),
      'hex alpha appended to an interpolated color. That only works on a hex literal, and every color ' +
        'here is a var() token, so the declaration is invalid and dropped. Use tint() from lib/color.ts.'
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 8: no dead var() fallbacks.
// ---------------------------------------------------------------------------
// If the first token is defined in :root, the fallback can never apply, so it
// is dead code that hides which color is really in effect. That mattered: a
// batch of error banners read `var(--color-accent, var(--color-danger-bg))`,
// which looks like a danger state but actually renders the BRAND accent , so
// on an orange-branded agency an error banner was indistinguishable from
// ordinary brand chrome.
for (const path of tsxFiles) {
  const source = withoutComments(readFileSync(path, 'utf8'));
  for (const use of source.matchAll(/var\(\s*(--[\w-]+)\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*\)/g)) {
    const [, primary, fallback] = use;
    if (!definedTokens.has(primary)) continue; // a real fallback for a scoped token
    fail(
      repoPath(path),
      lineOf(source, use.index ?? 0),
      `var(${primary}, var(${fallback})) , ${primary} is always defined, so the fallback is dead code. ` +
        'Keep whichever token you actually mean.'
    );
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`CSS contract scan found ${failures.length} issue(s):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nSee scripts/css-contract-scan.ts for why each rule exists.');
  process.exit(1);
}

console.log('CSS contract scan passed.');
