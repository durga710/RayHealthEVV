// Centralizes literals already in use across the app's hand-styled screens
// (headers, cards, pills) so new shared components — starting with the
// branded alert system — don't hand-copy them a 13th time. Existing screens
// are intentionally left as-is; this is not a retrofit.

export const colors = {
  navy: '#0f2d52',
  brandBlue: '#1a5fa8',
  brandBlueLight: '#2d7dd2',

  success: '#16a34a',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',

  danger: '#b91c1c',
  dangerDark: '#991b1b',
  dangerBg: '#fff5f5',
  dangerBorder: '#fecaca',

  amber: '#d97706',
  amberBg: '#fef3c7',
  amberBorder: '#f59e0b',

  purple: '#7c3aed',
  cyan: '#0891b2',
  slate: '#64748b',

  textPrimary: '#0f2d52',
  textSecondary: '#5a7088',
  textMuted: '#94a3b8',

  screenBg: '#eef3f8',
  cardBg: '#ffffff',
  border: '#e6edf4',
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
};
