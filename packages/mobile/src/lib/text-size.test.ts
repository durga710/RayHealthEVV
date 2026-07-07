import { describe, it, expect } from 'vitest';
import { parsePreset, PRESET_LABELS, PRESETS, readingStyle } from './text-size';

describe('readingStyle', () => {
  it('scales the 18px reading base across presets', () => {
    expect(readingStyle(18, 'standard')).toEqual({ fontSize: 18, lineHeight: 27 });
    expect(readingStyle(18, 'large')).toEqual({ fontSize: 21, lineHeight: 32 });
    expect(readingStyle(18, 'xlarge')).toEqual({ fontSize: 23, lineHeight: 35 });
  });

  it('keeps line height at 1.5× the scaled size (rounded)', () => {
    for (const preset of PRESETS) {
      const { fontSize, lineHeight } = readingStyle(20, preset);
      expect(lineHeight).toBe(Math.round(fontSize * 1.5));
    }
  });
});

describe('parsePreset', () => {
  it('accepts every known preset', () => {
    for (const preset of PRESETS) {
      expect(parsePreset(preset)).toBe(preset);
    }
  });

  it('falls back to standard for null, undefined, and garbage', () => {
    expect(parsePreset(null)).toBe('standard');
    expect(parsePreset(undefined)).toBe('standard');
    expect(parsePreset('huge')).toBe('standard');
    expect(parsePreset('')).toBe('standard');
  });
});

describe('presets', () => {
  it('are ordered smallest to largest with labels', () => {
    expect(PRESETS).toEqual(['standard', 'large', 'xlarge']);
    expect(PRESET_LABELS.xlarge).toBe('Extra large');
  });
});
