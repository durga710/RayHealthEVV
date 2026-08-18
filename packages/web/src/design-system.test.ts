import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AA_NON_TEXT,
  AA_TEXT,
  AGENCY_THEME_VARIABLES,
  composite,
  contrastRatio,
  parseCssColor,
  type Rgb,
} from '@rayhealth/core/domain/theme-resolver.js';

const srcDirectory = resolve(process.cwd(), 'src');
const colorLiteralPattern = /#[\da-f]{3,4}\b|#[\da-f]{6}(?:[\da-f]{2})?\b/gi;
const css = readFileSync(join(srcDirectory, 'index.css'), 'utf8');

/**
 * The `:root` declarations, as a raw name -> value map.
 *
 * Comments are stripped first: token names appear inside the explanatory
 * comments in index.css, and a naive scan reads those as declarations and
 * silently overwrites the real values with prose.
 */
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens: Record<string, string> = Object.fromEntries(
  [...(/:root\s*\{[\s\S]*?\n\}/.exec(cssWithoutComments)?.[0] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map((match) => [match[1], match[2].trim()])
);

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Resolve a token to a concrete color, following `var()` indirection and
 * flattening any alpha over `backdrop`.
 *
 * Compositing is the point: several tokens are 8-25% tints, and their real
 * contrast is the contrast of the composited result. Scoring the tint color
 * itself , which is what a naive check does , reports a number the user never
 * actually sees.
 */
function colorOf(token: string, backdrop: Rgb = WHITE, depth = 0): Rgb {
  const raw = tokens[token];
  if (!raw) throw new Error(`token ${token} is not defined in :root`);
  if (depth > 5) throw new Error(`token ${token} has a circular definition`);

  const indirect = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
  if (indirect) return colorOf(indirect[1], backdrop, depth + 1);

  // Translucent values MUST be matched before parseCssColor, which drops the
  // alpha channel. Scoring rgba(16, 116, 128, 0.08) as if it were solid teal
  // reports the contrast of a color nobody ever sees.
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(raw);
  if (rgba) {
    return composite(
      { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) },
      Number(rgba[4]),
      backdrop
    );
  }

  const direct = parseCssColor(raw);
  if (direct) return direct;

  throw new Error(`token ${token} has an unparseable value: ${raw}`);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    if (!entry.name.endsWith('.tsx') || entry.name.includes('.test.')) {
      return [];
    }

    return [path];
  });
}

describe('RayHealth visual system', () => {
  it('defines one bold, accessible brand contract for every surface', () => {
    expect(css).toContain('--color-on-brand:');
    expect(css).toContain('--color-text-on-dark:');
    expect(css).toContain('--color-surface-elevated:');
    expect(css).toContain('--gradient-brand:');
    expect(css).toContain('--shadow-card-hover:');
  });

  it('keeps page and component colors connected to shared tokens', () => {
    const violations = sourceFiles(srcDirectory).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const colors = source.match(colorLiteralPattern) ?? [];

      return colors.length === 0
        ? []
        : [`${relative(srcDirectory, path)}: ${[...new Set(colors.map((color) => color.toLowerCase()))].join(', ')}`];
    });

    expect(violations).toEqual([]);
  });

  it('gives every resolver-managed variable a static default', () => {
    // Without a default, an agency with no theme configured would get nothing
    // at all for that variable. scripts/css-contract-scan.ts enforces the
    // reverse direction too.
    for (const name of AGENCY_THEME_VARIABLES) {
      expect(tokens[name], `${name} missing from :root`).toBeTruthy();
    }
  });

  /**
   * Every pair below is a real pairing somewhere in index.css or a feature
   * page. The old version of this suite only checked white-against-token, which
   * is why `.btn-ghost` , brand-colored text on a brand-colored surface , went
   * undetected: nothing here knew which foreground met which background.
   */
  describe.each([
    // Labels on a brand-filled surface (.btn-primary, badges, avatars, and
    // every stop of --gradient-brand).
    ['--color-on-brand', '--color-primary', WHITE, AA_TEXT],
    ['--color-on-brand', '--color-primary-dark', WHITE, AA_TEXT],
    ['--color-on-brand', '--color-accent', WHITE, AA_TEXT],
    ['--color-on-brand', '--color-success', WHITE, AA_TEXT],
    ['--color-on-brand', '--color-danger', WHITE, AA_TEXT],
    ['--color-on-brand', '--color-warning', WHITE, AA_TEXT],
    ['--color-on-accent', '--color-accent', WHITE, AA_TEXT],

    // Brand color used AS TEXT on a light surface: .btn-ghost labels, every
    // link, and ~229 inline call sites. This is the pair whose absence produced
    // the invisible Refresh button.
    ['--color-primary', '--color-surface', WHITE, AA_TEXT],
    ['--color-primary-dark', '--color-surface', WHITE, AA_TEXT],
    ['--color-accent', '--color-surface', WHITE, AA_TEXT],
    ['--color-primary-dark', '--color-primary-bg', WHITE, AA_TEXT],

    // The text ramp on light surfaces.
    ['--color-text', '--color-surface', WHITE, AA_TEXT],
    ['--color-text-secondary', '--color-surface', WHITE, AA_TEXT],
    ['--color-text-muted', '--color-surface', WHITE, AA_TEXT],
    ['--color-text-subtle', '--color-surface', WHITE, AA_TEXT],
    ['--color-slate-700', '--color-surface', WHITE, AA_TEXT],
    ['--color-text', '--color-surface-soft', WHITE, AA_TEXT],
    ['--color-text-secondary', '--color-surface-soft', WHITE, AA_TEXT],

    // Semantic banners and badges: colored text on its own tint.
    ['--color-success-text', '--color-success-bg', WHITE, AA_TEXT],
    ['--color-danger-text', '--color-danger-bg', WHITE, AA_TEXT],
    ['--color-warning-text', '--color-warning-bg', WHITE, AA_TEXT],
    ['--color-info-text', '--color-info-bg', WHITE, AA_TEXT],

    // The dark sidebar rail. Contrast runs the other way here, which is why
    // --color-text-muted-on-dark exists as a separate token.
    ['--color-sidebar-text', '--color-sidebar', WHITE, AA_TEXT],
    ['--color-sidebar-text-active', '--color-sidebar', WHITE, AA_TEXT],
    ['--color-text-on-dark', '--color-sidebar', WHITE, AA_TEXT],
    ['--color-text-muted-on-dark', '--color-sidebar', WHITE, AA_TEXT],

    // Note on borders: --color-border and friends are deliberately NOT asserted
    // at 3:1. WCAG 1.4.11 covers non-text content required to IDENTIFY a
    // control, and these are decorative separators , a control here is
    // identified by its label and its fill, and its state by the focus ring,
    // which the theme resolver does guarantee at 3:1 against the surface.
  ] as const)('%s on %s', (foreground, background, backdrop, required) => {
    it(`meets ${required}:1`, () => {
      // A translucent background composites over the surface it sits on; the
      // dark rail composites over itself.
      const isDark = background.includes('sidebar');
      const base = isDark ? colorOf('--color-sidebar') : backdrop;
      const ratio = contrastRatio(colorOf(foreground, base), colorOf(background, base));
      expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(required);
    });
  });

  it('keeps the active sidebar item and role badge legible on the rail', () => {
    const rail = colorOf('--color-sidebar');
    expect(contrastRatio(colorOf('--color-sidebar-text-active'), colorOf('--color-sidebar-active', rail)))
      .toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colorOf('--color-brand-badge-text'), colorOf('--color-brand-badge-bg', rail)))
      .toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
