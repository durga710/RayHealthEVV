/**
 * Derives the full set of brand CSS custom properties from an agency's chosen
 * colors.
 *
 * WHY THIS EXISTS
 * ---------------
 * The web app used to override exactly three variables (`--color-primary`,
 * `--color-primary-bg`, `--color-primary-dark`) and leave everything else at
 * the RayHealth defaults. That left `--color-on-brand` pinned to white forever,
 * so a pale agency brand color produced white-on-pale text app-wide; it left
 * `--color-accent` at the stock orange even though agencies can supply one; and
 * it left a dozen `rgba(16, 116, 128, ...)` teal values that could never follow
 * an agency at all.
 *
 * Here every brand-dependent token is a pure function of the agency's colors,
 * and the foreground is chosen by measured contrast rather than assumed. That
 * is what makes an arbitrary future color scheme safe instead of merely lucky.
 *
 * CONTRACT
 * --------
 * `resolveAgencyTheme` is total: every input, including `{}`, garbage strings,
 * and attempted CSS injection, returns a complete and WCAG AA-clean variable
 * set. It never throws and never returns a partial map. Every emitted value is
 * built out of numbers, so no caller-supplied text can reach the CSSOM.
 *
 * This module must stay dependency-free. The web bundle deep-imports it as
 * `@rayhealth/core/domain/theme-resolver.js` precisely so it does not drag the
 * core barrel (knex, pg, ssh2-sftp-client) into the browser.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface BrandInput {
  primaryColor?: string;
  primaryDark?: string;
  accentColor?: string;
}

export interface ThemeNote {
  field: string;
  kind: 'rejected' | 'derived' | 'clamped';
  detail: string;
}

export interface ResolvedTheme {
  variables: Record<string, string>;
  notes: ThemeNote[];
}

/** WCAG AA for normal-size text. Button and link labels are normal-size. */
export const AA_TEXT = 4.5;
/** WCAG AA for non-text affordances: focus rings, borders that carry meaning. */
export const AA_NON_TEXT = 3;

/** RayHealth defaults, and the fallback for any field that fails to parse. */
const DEFAULT_PRIMARY = '#107480';
const DEFAULT_ACCENT = '#C94E0E';

/** The two inks the UI can put on a brand surface. Mirrors index.css. */
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const INK: Rgb = { r: 15, g: 23, b: 42 };     // --color-text, slate-900
const SIDEBAR: Rgb = { r: 15, g: 23, b: 42 }; // --color-sidebar
const SURFACE: Rgb = WHITE;                   // --color-surface

// -- Color primitives -------------------------------------------------------

const HEX3 = /^#([\da-f])([\da-f])([\da-f])$/i;
const HEX6 = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*[\d.%]+\s*)?\)$/i;

function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Parse a hex or rgb()/rgba() color. Deliberately narrow: named colors, hsl(),
 * and anything else return null so an unrecognised value falls back to the
 * default palette rather than being echoed into a stylesheet.
 */
export function parseCssColor(value: string): Rgb | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 32) return null;

  const short = HEX3.exec(raw);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }

  const long = HEX6.exec(raw);
  if (long) {
    return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) };
  }

  const fn = RGB_FN.exec(raw);
  if (fn) {
    const channels = [fn[1], fn[2], fn[3]].map(Number);
    if (channels.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
    return { r: Math.round(channels[0]), g: Math.round(channels[1]), b: Math.round(channels[2]) };
  }

  return null;
}

export function toHex({ r, g, b }: Rgb): string {
  const hex = [r, g, b].map((c) => clampChannel(c).toString(16).padStart(2, '0')).join('');
  return `#${hex}`.toUpperCase();
}

export function toRgba(color: Rgb, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${quantizeAlpha(a)})`;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Flatten a translucent color over an opaque one. Needed because several tokens
 * are alpha tints, and their real contrast is the contrast of the composited
 * result, not of the tint color itself.
 */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    r: clampChannel((fg.r * a) + (bg.r * (1 - a))),
    g: clampChannel((fg.g * a) + (bg.g * (1 - a))),
    b: clampChannel((fg.b * a) + (bg.b * (1 - a))),
  };
}

// -- HSL round-trip, so lightness moves without losing hue or saturation -----

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = ((bn - rn) / delta) + 2;
  else h = ((rn - gn) / delta) + 4;

  return { h: ((h * 60) + 360) % 360, s, l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs((2 * l) - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - (c / 2);
  const sector = Math.floor((((h % 360) + 360) % 360) / 60);
  const table: [number, number, number][] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const [r, g, b] = table[sector];
  return {
    r: clampChannel((r + m) * 255),
    g: clampChannel((g + m) * 255),
    b: clampChannel((b + m) * 255),
  };
}

/** Move a color's lightness by `delta` (-1..1), preserving hue and saturation. */
export function shiftLightness(color: Rgb, delta: number): Rgb {
  const { h, s, l } = toHsl(color);
  return fromHsl(h, s, Math.max(0, Math.min(1, l + delta)));
}

/** Whichever candidate ink reads best against `background`. */
export function pickInk(background: Rgb, candidates: Rgb[] = [WHITE, INK]): Rgb {
  return candidates.reduce((best, candidate) => (
    contrastRatio(candidate, background) > contrastRatio(best, background) ? candidate : best
  ));
}

/**
 * Nudge `fill` away from `ink` until it clears `target`.
 *
 * The fill moves, not the ink, and the agency's literal color is preserved
 * separately as `--color-brand-raw` for text-free surfaces. So a brand color
 * that cannot carry a label is deepened a few percent for the surfaces that do
 * carry labels, rather than being replaced with something off-brand.
 */
export function ensureContrast(fill: Rgb, ink: Rgb, target: number): Rgb {
  if (contrastRatio(fill, ink) >= target) return fill;

  // Search BOTH directions rather than guessing one from the luminance
  // ordering. A fill that is already at a rail , pure white against white ink
  // is the real case , has only one way to go, and picking the wrong direction
  // there returns the color unchanged and silently breaks the guarantee.
  const solutions: Rgb[] = [];
  for (const step of [-0.02, 0.02]) {
    let candidate = fill;
    for (let i = 0; i < 60; i += 1) {
      const next = shiftLightness(candidate, step);
      if (toHex(next) === toHex(candidate)) break; // hit black or white
      candidate = next;
      if (contrastRatio(candidate, ink) >= target) {
        solutions.push(candidate);
        break;
      }
    }
  }

  if (solutions.length === 0) return fill;

  // Prefer whichever direction departs least from the color the agency chose.
  const distance = (color: Rgb): number => Math.abs(relativeLuminance(color) - relativeLuminance(fill));
  return solutions.reduce((best, candidate) => (distance(candidate) < distance(best) ? candidate : best));
}

/** Alpha values are emitted at this precision, so they are also SOLVED at it. */
const ALPHA_STEP = 0.02;
export const ALPHA_PRECISION = 3;

function quantizeAlpha(alpha: number): number {
  return Number(Math.max(0, Math.min(1, alpha)).toFixed(ALPHA_PRECISION));
}

/**
 * Walk alpha from `start` until the composited result satisfies `ok`.
 *
 * Each candidate is quantized to the precision `toRgba` emits *before* it is
 * tested. Solving with a full-precision alpha and then rounding it on the way
 * out silently ships a value that was never checked: at a contrast boundary the
 * rounding shifts a composited channel by one and the ratio lands just under
 * target. What is verified here has to be exactly what reaches the stylesheet.
 */
function alphaWhere(
  color: Rgb,
  over: Rgb,
  start: number,
  direction: 1 | -1,
  ok: (composited: Rgb) => boolean
): number {
  for (let i = 0; i < 60; i += 1) {
    const alpha = quantizeAlpha(start + (direction * ALPHA_STEP * i));
    if (ok(composite(color, alpha, over))) return alpha;
    if (alpha <= 0 || alpha >= 1) return alpha;
  }
  return direction === 1 ? 1 : 0;
}

// -- The resolver -----------------------------------------------------------

/**
 * Every variable this module manages. AuthContext clears the whole list before
 * applying a theme, so switching agencies can never leave a stale value behind,
 * and scripts/css-contract-scan.ts cross-checks it against the `:root` block in
 * index.css so a new brand-derived token cannot be added without also being
 * made overridable.
 */
export const AGENCY_THEME_VARIABLES: readonly string[] = [
  '--color-brand-raw',
  '--color-primary',
  '--color-primary-dark',
  '--color-primary-light',
  '--color-primary-bg',
  '--color-on-brand',
  '--color-accent',
  '--color-accent-dark',
  '--color-accent-light',
  '--color-accent-bg',
  '--color-on-accent',
  '--color-info',
  '--color-info-bg',
  '--color-info-text',
  '--color-info-border',
  '--color-sidebar-active',
  '--color-brand-badge-bg',
  '--color-brand-badge-text',
  '--gradient-brand',
  '--gradient-brand-hover',
  '--gradient-page',
  '--shadow-brand',
  '--shadow-card-hover',
  '--shadow-focus',
  '--focus-outline-color',
];

function readColor(
  value: string | undefined,
  field: string,
  fallback: string,
  notes: ThemeNote[]
): Rgb {
  if (value === undefined || value.trim() === '') return parseCssColor(fallback) as Rgb;
  const parsed = parseCssColor(value);
  if (parsed) return parsed;
  notes.push({
    field,
    kind: 'rejected',
    detail: 'not a hex or rgb() color; using the RayHealth default',
  });
  return parseCssColor(fallback) as Rgb;
}

export function resolveAgencyTheme(input: BrandInput | null | undefined): ResolvedTheme {
  const notes: ThemeNote[] = [];
  const brand = input ?? {};

  const rawPrimary = readColor(brand.primaryColor, 'primaryColor', DEFAULT_PRIMARY, notes);
  const rawAccent = readColor(brand.accentColor, 'accentColor', DEFAULT_ACCENT, notes);

  // `--color-primary` is used BOTH as a fill behind labels and as text on the
  // white surface (.btn-ghost, links, ~229 call sites). Guaranteeing it against
  // white satisfies both roles at once: readable as text, and dark enough that
  // white reads on top of it.
  const primary = ensureContrast(rawPrimary, SURFACE, AA_TEXT);
  if (toHex(primary) !== toHex(rawPrimary)) {
    notes.push({
      field: 'primaryColor',
      kind: 'clamped',
      detail: `${toHex(rawPrimary)} deepened to ${toHex(primary)} so labels stay readable; the original is kept for logo and gradient surfaces`,
    });
  }

  const suppliedDark = brand.primaryDark?.trim() ? parseCssColor(brand.primaryDark) : null;
  if (brand.primaryDark?.trim() && !suppliedDark) {
    notes.push({
      field: 'primaryDark',
      kind: 'rejected',
      detail: 'not a hex or rgb() color; derived from primaryColor',
    });
  }
  const primaryDark = ensureContrast(suppliedDark ?? shiftLightness(primary, -0.12), SURFACE, AA_TEXT);
  const primaryLight = shiftLightness(primary, 0.34);

  const accent = ensureContrast(rawAccent, SURFACE, AA_TEXT);
  if (toHex(accent) !== toHex(rawAccent)) {
    notes.push({
      field: 'accentColor',
      kind: 'clamped',
      detail: `${toHex(rawAccent)} deepened to ${toHex(accent)} so labels stay readable`,
    });
  }
  const accentDark = shiftLightness(accent, -0.08);
  const accentLight = shiftLightness(accent, 0.38);

  // The ink has to clear AA against every stop of --gradient-brand, not just
  // --color-primary: a gradient-filled button shows all three.
  const stops = [primaryDark, primary, accent];
  const worstAgainstStops = (ink: Rgb): number => Math.min(...stops.map((stop) => contrastRatio(ink, stop)));
  const onBrand = [WHITE, INK].reduce((best, candidate) => (
    worstAgainstStops(candidate) > worstAgainstStops(best) ? candidate : best
  ));
  const onAccent = pickInk(accent);

  // Alpha tints: the guarantee is about the COMPOSITED result, so solve for the
  // alpha rather than hardcoding one that only happened to work for teal.
  const infoBgAlpha = 0.08;
  const infoSurface = composite(primary, infoBgAlpha, SURFACE);
  const infoText = ensureContrast(primaryDark, infoSurface, AA_TEXT);

  // Sidebar-active sits on the dark rail and carries white text: lower the
  // alpha until white still clears AA over the composited panel.
  const sidebarActiveAlpha = alphaWhere(primary, SIDEBAR, 0.22, -1, (c) => contrastRatio(WHITE, c) >= AA_TEXT);

  // The focus ring is a non-text affordance: raise its alpha until it is
  // actually visible against the surface it is drawn on.
  const focusAlpha = alphaWhere(primary, SURFACE, 0.28, 1, (c) => contrastRatio(c, SURFACE) >= AA_NON_TEXT);

  // The sidebar role badge: pick its ink against the composited badge fill
  // instead of the orphaned lavender that used to be hardcoded there.
  const badgeAlpha = 0.2;
  const badgeSurface = composite(primary, badgeAlpha, SIDEBAR);
  const badgeText = ensureContrast(primaryLight, badgeSurface, AA_NON_TEXT);

  const variables: Record<string, string> = {
    // The agency's literal color, never clamped. Text-free surfaces only.
    '--color-brand-raw': toHex(rawPrimary),

    '--color-primary': toHex(primary),
    '--color-primary-dark': toHex(primaryDark),
    '--color-primary-light': toHex(primaryLight),
    '--color-primary-bg': toRgba(primary, 0.08),
    '--color-on-brand': toHex(onBrand),

    '--color-accent': toHex(accent),
    '--color-accent-dark': toHex(accentDark),
    '--color-accent-light': toHex(accentLight),
    '--color-accent-bg': toRgba(accent, 0.08),
    '--color-on-accent': toHex(onAccent),

    '--color-info': toHex(primary),
    '--color-info-bg': toRgba(primary, infoBgAlpha),
    '--color-info-text': toHex(infoText),
    '--color-info-border': toRgba(primary, 0.25),

    '--color-sidebar-active': toRgba(primary, sidebarActiveAlpha),
    '--color-brand-badge-bg': toRgba(primary, badgeAlpha),
    '--color-brand-badge-text': toHex(badgeText),

    '--gradient-brand': `linear-gradient(135deg, ${toHex(primaryDark)} 0%, ${toHex(primary)} 58%, ${toHex(accent)} 135%)`,
    '--gradient-brand-hover': `linear-gradient(135deg, ${toHex(shiftLightness(primaryDark, -0.06))} 0%, ${toHex(primaryDark)} 58%, ${toHex(accentDark)} 135%)`,
    '--gradient-page': `radial-gradient(circle at 12% -10%, ${toRgba(primaryLight, 0.26)}, transparent 28rem), linear-gradient(180deg, ${toHex(shiftLightness(primary, 0.47))} 0%, var(--color-bg) 24rem)`,

    '--shadow-brand': `0 14px 30px -16px ${toRgba(primaryDark, 0.72)}`,
    '--shadow-card-hover': `0 22px 50px -28px ${toRgba(primaryDark, 0.42)}, 0 8px 20px -16px rgba(15, 23, 42, 0.28)`,
    '--shadow-focus': `0 0 0 3px ${toRgba(primary, focusAlpha)}`,
    '--focus-outline-color': toRgba(primary, Math.min(1, focusAlpha + 0.06)),
  };

  return { variables, notes };
}
