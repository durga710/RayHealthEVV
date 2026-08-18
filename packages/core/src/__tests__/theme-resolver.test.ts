import { describe, expect, it } from 'vitest';
import {
  AA_NON_TEXT,
  AA_TEXT,
  AGENCY_THEME_VARIABLES,
  composite,
  contrastRatio,
  ensureContrast,
  parseCssColor,
  pickInk,
  resolveAgencyTheme,
  shiftLightness,
  toHex,
  type Rgb,
} from '../domain/theme-resolver.js';

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const SIDEBAR: Rgb = { r: 15, g: 23, b: 42 };

/**
 * A brand color that already reads well, one that is far too pale, one that is
 * mid-tone (the genuinely hard case: it fails against white AND black), plus
 * the hues an onboarding home-care agency is most likely to hand us.
 */
const ADVERSARIAL = [
  '#107480', // RayHealth teal, the incumbent
  '#FFFFFF', // pure white
  '#000000', // pure black
  '#808080', // mid grey: 3.95:1 vs white, 4.4:1 vs black. Fails both.
  '#FFFF00', // neon yellow
  '#00FF00', // pure green, luminance 0.715, the worst case for white ink
  '#00FFFF', // cyan
  '#FFD400', // sunflower
  '#D9F7E7', // pale mint
  '#FFF8E1', // cream
  '#EE6C2C', // the orange in the reported screenshot
  '#C94E0E', // the stock accent
  '#1A5FA8', // a plausible corporate blue
  '#7C3AED', // a plausible corporate purple
  '#FF69B4', // hot pink
  '#3D2B1F', // near-black brown
];

/** Deterministic xorshift, so a failure is always reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0xffffff) / 0xffffff;
  };
}

function randomHexes(count: number, seed = 0x5eed): string[] {
  const next = makeRandom(seed);
  return Array.from({ length: count }, () => {
    const value = Math.floor(next() * 0xffffff);
    return `#${value.toString(16).padStart(6, '0')}`;
  });
}

const BRAND_COLORS = [...ADVERSARIAL, ...randomHexes(400)];

function rgb(value: string): Rgb {
  const parsed = parseCssColor(value);
  if (!parsed) throw new Error(`resolver emitted an unparseable value: ${value}`);
  return parsed;
}

/** Pull the alpha back out of an emitted `rgba(r, g, b, a)` string. */
function alphaOf(value: string): number {
  const match = /rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/.exec(value.trim());
  if (!match) throw new Error(`expected an rgba() value, got: ${value}`);
  return Number(match[1]);
}

describe('parseCssColor', () => {
  it('accepts the formats an agency can realistically supply', () => {
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColor('#107480')).toEqual({ r: 16, g: 116, b: 128 });
    expect(parseCssColor('#10748080')).toEqual({ r: 16, g: 116, b: 128 });
    expect(parseCssColor('rgb(16, 116, 128)')).toEqual({ r: 16, g: 116, b: 128 });
    expect(parseCssColor('rgba(16, 116, 128, 0.5)')).toEqual({ r: 16, g: 116, b: 128 });
  });

  it('rejects anything that could carry a payload into the stylesheet', () => {
    for (const hostile of [
      'red',
      'chartreuse',
      'red; --color-text: red',
      'url(https://evil.example/x.png)',
      'expression(alert(1))',
      'var(--color-danger)',
      '#12345',
      '',
      '   ',
      'hsl(180, 50%, 40%)',
    ]) {
      expect(parseCssColor(hostile), hostile).toBeNull();
    }
  });
});

describe('color math', () => {
  it('shiftLightness preserves hue and saturation', () => {
    const lighter = shiftLightness({ r: 16, g: 116, b: 128 }, 0.2);
    const darker = shiftLightness({ r: 16, g: 116, b: 128 }, -0.2);
    // teal stays teal: blue >= green > red at both ends
    expect(lighter.b).toBeGreaterThanOrEqual(lighter.g);
    expect(lighter.g).toBeGreaterThan(lighter.r);
    expect(darker.b).toBeGreaterThanOrEqual(darker.g);
    expect(darker.g).toBeGreaterThan(darker.r);
  });

  it('composite flattens a tint onto its backdrop', () => {
    expect(composite({ r: 0, g: 0, b: 0 }, 0, WHITE)).toEqual(WHITE);
    expect(composite({ r: 0, g: 0, b: 0 }, 1, WHITE)).toEqual({ r: 0, g: 0, b: 0 });
    expect(composite({ r: 0, g: 0, b: 0 }, 0.5, WHITE)).toEqual({ r: 128, g: 128, b: 128 });
  });

  it('pickInk chooses dark ink on a pale surface and white on a deep one', () => {
    expect(toHex(pickInk(rgb('#FFF8E1')))).toBe('#0F172A');
    expect(toHex(pickInk(rgb('#0C5D66')))).toBe('#FFFFFF');
  });

  it('ensureContrast moves the fill, not the ink, and converges', () => {
    const pale = rgb('#FFF8E1');
    const fixed = ensureContrast(pale, WHITE, AA_TEXT);
    expect(contrastRatio(fixed, WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('resolveAgencyTheme', () => {
  it('is total: any input yields a complete variable set', () => {
    const inputs = [
      undefined,
      null,
      {},
      { primaryColor: '' },
      { primaryColor: 'not a color' },
      { primaryColor: '#107480', primaryDark: 'garbage', accentColor: 'also garbage' },
    ];

    for (const input of inputs) {
      const { variables } = resolveAgencyTheme(input);
      for (const name of AGENCY_THEME_VARIABLES) {
        expect(variables[name], `${JSON.stringify(input)} -> ${name}`).toBeTruthy();
      }
      expect(Object.keys(variables).sort()).toEqual([...AGENCY_THEME_VARIABLES].sort());
    }
  });

  it('reports what it changed so an admin can be told', () => {
    const { notes } = resolveAgencyTheme({ primaryColor: '#FFFF00' });
    expect(notes.some((note) => note.field === 'primaryColor' && note.kind === 'clamped')).toBe(true);

    const rejected = resolveAgencyTheme({ primaryColor: 'octarine' });
    expect(rejected.notes.some((note) => note.kind === 'rejected')).toBe(true);

    expect(resolveAgencyTheme({ primaryColor: '#107480' }).notes).toEqual([]);
  });

  it('keeps the agency literal color available for text-free surfaces', () => {
    const { variables } = resolveAgencyTheme({ primaryColor: '#FFFF00' });
    expect(variables['--color-brand-raw']).toBe('#FFFF00');
    // ...while the surface that actually carries a label got deepened.
    expect(variables['--color-primary']).not.toBe('#FFFF00');
  });

  // This is the load-bearing test. Every invariant below is a real pairing in
  // index.css, and each one is a bug that shipped at least once.
  describe.each(BRAND_COLORS)('brand color %s', (brandColor) => {
    const { variables } = resolveAgencyTheme({ primaryColor: brandColor });
    const primary = rgb(variables['--color-primary']);
    const primaryDark = rgb(variables['--color-primary-dark']);
    const accent = rgb(variables['--color-accent']);
    const onBrand = rgb(variables['--color-on-brand']);

    it('emits only values that parse back', () => {
      for (const name of AGENCY_THEME_VARIABLES) {
        const value = variables[name];
        expect(value).not.toMatch(/NaN|undefined|null/);
        if (name.startsWith('--color-')) expect(parseCssColor(value), name).not.toBeNull();
      }
    });

    it('never lets caller text reach the CSSOM', () => {
      for (const name of AGENCY_THEME_VARIABLES) {
        expect(variables[name], name).not.toMatch(/[;}]|\/\*|url\(|expression/);
      }
    });

    it('keeps the on-brand ink readable on every gradient stop', () => {
      // --gradient-brand shows all three stops, so scoring only against
      // --color-primary (what the old design-system test did) is not enough.
      for (const [label, stop] of [['primary-dark', primaryDark], ['primary', primary], ['accent', accent]] as const) {
        expect(contrastRatio(onBrand, stop), `on-brand vs ${label}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it('keeps brand-colored text readable on the white surface', () => {
      // .btn-ghost labels and every link are --color-primary on --color-surface.
      // This is the invariant whose absence produced the invisible Refresh button.
      expect(contrastRatio(primary, WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(primaryDark, WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(accent, WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('keeps info text readable on the composited info tint', () => {
      const infoSurface = composite(primary, alphaOf(variables['--color-info-bg']), WHITE);
      expect(contrastRatio(rgb(variables['--color-info-text']), infoSurface)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('keeps the active sidebar item readable on the dark rail', () => {
      const active = composite(primary, alphaOf(variables['--color-sidebar-active']), SIDEBAR);
      expect(contrastRatio(WHITE, active)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('keeps the sidebar role badge legible', () => {
      const badge = composite(primary, alphaOf(variables['--color-brand-badge-bg']), SIDEBAR);
      expect(contrastRatio(rgb(variables['--color-brand-badge-text']), badge)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it('gives the focus ring a visible edge', () => {
      const ringAlpha = alphaOf(/rgba\([^)]*\)/.exec(variables['--shadow-focus'])![0]);
      const ring = composite(primary, ringAlpha, WHITE);
      expect(contrastRatio(ring, WHITE)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it('is a fixed point: re-resolving a resolved color changes nothing', () => {
      const again = resolveAgencyTheme({ primaryColor: variables['--color-primary'] });
      expect(again.variables['--color-primary']).toBe(variables['--color-primary']);
    });
  });
});
