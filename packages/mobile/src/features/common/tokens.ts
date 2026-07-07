// The app's design system. Every screen styles from these tokens — colors,
// type scale, spacing, radii, shadows, gradients. Do not hand-type hex values
// or ad-hoc font sizes in screens; if a value is missing here, add it here
// first so the whole app moves together.

export const colors = {
  // Brand
  navy: '#0f2d52',
  brandBlue: '#1a5fa8',
  brandBlueDark: '#0f3d72', // gradient end for primary CTAs
  brandBlueLight: '#2d7dd2',

  // Semantic — success
  success: '#16a34a',
  successDark: '#15803d',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',

  // Semantic — danger (errors, destructive, overdue)
  danger: '#b91c1c',
  dangerDark: '#991b1b',
  dangerBg: '#fff5f5',
  dangerBorder: '#fecaca',

  // Semantic — warning (flags, pending review, expiring)
  amber: '#d97706',
  amberDark: '#92400e',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',

  // Accent tints (icon circles, category accents)
  purple: '#7c3aed',
  cyan: '#0891b2',
  teal: '#0f766e',
  slate: '#64748b',

  // Text on light surfaces — exactly three tiers.
  textPrimary: '#0f2d52',
  textSecondary: '#5a7088',
  textMuted: '#94a3b8',

  // Text on the brand gradient — exactly three tiers.
  onGradient: '#ffffff',
  onGradientSoft: '#a8c8e8',
  onGradientFaint: '#6898c0',

  // Surfaces
  screenBg: '#eef3f8',
  cardBg: '#ffffff',
  border: '#e6edf4',
  pressedBg: '#f5f9fd',

  // Form fields
  inputBg: '#f7fafd',
  inputBorder: '#dce8f2',
  inputText: '#1a3a5c',
  placeholder: '#b0c4d8',

  // Controls
  chevron: '#bcccdc',
  tabInactive: '#90a4b8',
  disabled: '#a8bdd4',
} as const;

/**
 * Type scale. Use these instead of raw fontSize/fontWeight pairs:
 *   hero      — screen-level hero titles (login wordmark, greeting)
 *   title     — screen headers on gradients
 *   heading   — card/section headings (client names, dialog titles)
 *   body      — primary content text
 *   sub       — secondary line under a heading
 *   label     — uppercase section labels / form labels
 *   caption   — smallest metadata (pills, hints, timestamps)
 *   readingHeading / readingBody — long-form lesson text in the course player,
 *               sized up for older readers; the player scales these bases with
 *               its text-size presets (src/lib/text-size.ts), which also derive
 *               the 1.5× line height.
 */
export const typography = {
  hero: { fontSize: 27, fontWeight: '900', letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heading: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  caption: { fontSize: 11, fontWeight: '600' },
  readingHeading: { fontSize: 20, fontWeight: '800' },
  readingBody: { fontSize: 18, fontWeight: '500' },
} as const;

/** 4-pt spacing scale. Compose layouts from these steps only. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
  hero: 24,
  pill: 999,
} as const;

export const shadow = {
  subtle: {
    shadowColor: colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  card: {
    shadowColor: colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Raised interactive cards on gradient backgrounds (agency picker, login card). */
  raised: {
    shadowColor: colors.navy,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
} as const;

export const gradients = {
  header: ['#0f2d52', '#1a5fa8'] as const,
  hero: ['#0f2d52', '#1a5fa8', '#2d7dd2'] as const,
  /** Primary CTA fill (enabled / disabled). */
  cta: ['#1a5fa8', '#0f3d72'] as const,
  ctaDisabled: ['#8aaac8', '#6e90ad'] as const,
  ctaSuccess: ['#16a34a', '#15803d'] as const,
};

/** `${hex}${alpha.tint}` → 10% tint of a solid color (icon circles, pill bgs). */
export const alpha = {
  tint: '1a',
  tintStrong: '26',
} as const;
