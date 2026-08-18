import { describe, expect, it } from 'vitest';
import { agencyThemeSchema } from '../domain/agency.js';
import { AgencyRepository } from '../repositories/agency-repository.js';

/**
 * `findTheme` reads a jsonb column, so it is exercised here through a stub db
 * rather than a real connection. The point under test is the normalization, not
 * the query.
 */
function repoReturning(features: unknown): AgencyRepository {
  const db = () => ({
    select: () => ({ where: () => ({ first: async () => ({ features }) }) }),
  });
  return new AgencyRepository(db as never);
}

describe('agencyThemeSchema', () => {
  it('accepts the color formats an agency can supply', () => {
    const parsed = agencyThemeSchema.safeParse({
      primaryColor: '#1A5FA8',
      primaryDark: '#124173',
      accentColor: 'rgb(201, 78, 14)',
      logoText: 'Sunrise Homecare',
      tagline: 'Care that shows up',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects colors that are not hex or rgb()', () => {
    for (const primaryColor of ['red', 'chartreuse', 'var(--x)', 'url(a)', 'red; --color-text: red', '#12345']) {
      expect(agencyThemeSchema.safeParse({ primaryColor }).success, primaryColor).toBe(false);
    }
  });

  it('caps the brand name so it cannot break the sidebar layout', () => {
    expect(agencyThemeSchema.safeParse({ logoText: 'x'.repeat(41) }).success).toBe(false);
    expect(agencyThemeSchema.safeParse({ logoText: 'x'.repeat(40) }).success).toBe(true);
  });
});

describe('AgencyRepository.findTheme', () => {
  it('returns a validated theme', async () => {
    const theme = await repoReturning({ theme: { primaryColor: '#1A5FA8', logoText: 'Sunrise Homecare' } }).findTheme('a');
    expect(theme).toEqual({ primaryColor: '#1A5FA8', logoText: 'Sunrise Homecare' });
  });

  it('salvages the good fields of a partly-bad legacy row', async () => {
    // A row written before the schema was tightened. Dropping the whole object
    // over one bad hex would cost the agency its brand name for no reason.
    const theme = await repoReturning({
      theme: { primaryColor: 'ultraviolet', logoText: 'Sunrise Homecare', tagline: 'Care that shows up' },
    }).findTheme('a');
    expect(theme).toEqual({ logoText: 'Sunrise Homecare', tagline: 'Care that shows up' });
  });

  it('drops unknown keys instead of passing them through to the CSSOM', async () => {
    const theme = await repoReturning({
      theme: { primaryColor: '#1A5FA8', 'background-image': 'url(https://evil.example/x.png)' },
    }).findTheme('a');
    expect(theme).toEqual({ primaryColor: '#1A5FA8' });
  });

  it('reads a jsonb column that arrives as a string', async () => {
    const theme = await repoReturning(JSON.stringify({ theme: { primaryColor: '#1A5FA8' } })).findTheme('a');
    expect(theme).toEqual({ primaryColor: '#1A5FA8' });
  });

  it('returns null when there is no usable theme at all', async () => {
    expect(await repoReturning({}).findTheme('a')).toBeNull();
    expect(await repoReturning({ theme: null }).findTheme('a')).toBeNull();
    expect(await repoReturning({ theme: 'not an object' }).findTheme('a')).toBeNull();
    expect(await repoReturning({ theme: { primaryColor: 'nope' } }).findTheme('a')).toBeNull();
  });
});
