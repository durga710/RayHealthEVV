import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const schemaSource = readFileSync(
  fileURLToPath(new URL('../migrations/schema.ts', import.meta.url)),
  'utf8',
)

const verifierSource = readFileSync(
  fileURLToPath(new URL('../../../../scripts/verify-audit-triggers.mjs', import.meta.url)),
  'utf8',
)

describe('archived audit evidence immutability', () => {
  it('blocks update, delete, and truncate on audit_events_archive', () => {
    expect(schemaSource).toContain('audit_events_archive_block_mutation_trg')
    expect(schemaSource).toMatch(
      /BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events_archive/,
    )
  })

  it('keeps the archive trigger in the live database verifier', () => {
    expect(verifierSource).toContain("name: 'audit_events_archive_block_mutation_trg'")
    expect(verifierSource).toContain("table: 'audit_events_archive'")
  })
})
