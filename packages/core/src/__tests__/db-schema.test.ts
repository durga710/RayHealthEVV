// @ts-ignore
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDbConfig } from '../db/knex.js';

describe('core schema migration', () => {
  const config = buildDbConfig();
  // @ts-ignore
  const client = new Client(config.connection);
  let isConnected = false;

  beforeAll(async () => {
    try {
      await client.connect();
      isConnected = true;
    } catch (e) {
      console.warn('Skipping DB test - no connection');
    }
  });

  afterAll(async () => {
    if (isConnected) await client.end();
  });

  it('creates the agency and authorization tables', async () => {
    if (!isConnected) return;
    const result = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('agencies', 'authorizations', 'visit_templates', 'assignments')
      order by table_name
    `);

    expect(result.rows.map((row: any) => row.table_name)).toEqual([
      'agencies',
      'assignments',
      'authorizations',
      'visit_templates'
    ]);
  });
});
