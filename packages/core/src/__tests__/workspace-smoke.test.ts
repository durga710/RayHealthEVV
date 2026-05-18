import { describe, expect, it } from 'vitest';
import { pennsylvaniaOperatingTracks } from '../config/pennsylvania.js';

describe('workspace bootstrap', () => {
  it('exports Pennsylvania operating tracks from core', () => {
    expect(pennsylvaniaOperatingTracks).toEqual(['personal-assistance', 'home-health']);
  });
});
