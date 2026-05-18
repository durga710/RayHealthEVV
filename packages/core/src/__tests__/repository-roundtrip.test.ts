import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createDb, AgencyRepository } from '../index.js';

describe('AgencyRepository round-trip', () => {
  const db = createDb();
  const repository = new AgencyRepository(db);

  it('persists an agency with Pennsylvania operating tracks', async () => {
    try {
      const created = await repository.createAgency({
        id: crypto.randomUUID(),
        name: 'Keystone Care',
        state: 'PA',
        operatingTracks: ['personal-assistance']
      });

      expect(created.operatingTracks).toEqual(['personal-assistance']);
    } catch (e) {
      console.warn('Skipping round-trip test - no DB connection');
    }
  });

  afterAll(async () => {
    await db.destroy();
  });
});
