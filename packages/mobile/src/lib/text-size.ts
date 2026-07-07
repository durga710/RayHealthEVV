/**
 * Text-size presets for long-form lesson reading in the course player.
 * Pure math (no React Native imports) so it is unit-testable; the screen owns
 * the expo-secure-store persistence using TEXT_SIZE_KEY.
 *
 * Baseline reading sizes live in tokens.ts (typography.readingBody /
 * readingHeading); these presets scale those bases and derive the 1.5× line
 * height so leading grows with the text.
 */

export type TextSizePreset = 'standard' | 'large' | 'xlarge';

export const PRESETS: TextSizePreset[] = ['standard', 'large', 'xlarge'];

export const PRESET_LABELS: Record<TextSizePreset, string> = {
  standard: 'Standard',
  large: 'Large',
  xlarge: 'Extra large',
};

const MULTIPLIERS: Record<TextSizePreset, number> = {
  standard: 1,
  large: 1.15,
  xlarge: 1.3,
};

export const TEXT_SIZE_KEY = 'rayhealth.lessonTextSize';

export function readingStyle(
  baseFontSize: number,
  preset: TextSizePreset,
): { fontSize: number; lineHeight: number } {
  const fontSize = Math.round(baseFontSize * MULTIPLIERS[preset]);
  return { fontSize, lineHeight: Math.round(fontSize * 1.5) };
}

/** Safe hydration from storage: anything unrecognized falls back to standard. */
export function parsePreset(raw: string | null | undefined): TextSizePreset {
  return PRESETS.includes(raw as TextSizePreset) ? (raw as TextSizePreset) : 'standard';
}
