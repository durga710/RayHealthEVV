#!/usr/bin/env tsx
/**
 * seed-app-store-fixture.ts
 *
 * Idempotent, prod-guarded seed for the App Store screenshot caregiver fixture.
 *
 * Refuses to run when DATABASE_URL:
 *   - is missing
 *   - contains a known production hostname
 *   - does NOT include a `branch=` parameter (Neon branch indicator)
 *
 * Use:
 *   DATABASE_URL='postgres://...?branch=app-store-screenshots' \
 *     npx tsx packages/core/scripts/seed-app-store-fixture.ts
 *
 * Synthetic, non-PHI data only. Re-runnable. Inserts use ON CONFLICT DO NOTHING
 * semantics by checking existence first.
 */

import bcrypt from 'bcryptjs'
import { createDb } from '../src/db/knex.js'
import type { Knex } from 'knex'

// ---------- Fixture data (synthetic, no PHI) ----------

const AGENCY_ID = 'e1c4a7e3-1cad-4001-8e0a-000000000001'
const CLIENT_ID = '00000000-0000-4000-8000-000000000001'
const CAREGIVER_ID = '00000000-0000-4000-8000-000000000002'
const CAREGIVER_USER_ID = '00000000-0000-4000-8000-000000000003'
const VISIT_TEMPLATE_ID = '00000000-0000-4000-8000-000000000010'
const ASSIGNMENT_ID = '00000000-0000-4000-8000-000000000020'

const FIXTURE_EMAIL = 'test-caregiver-fixture@rayhealthevv.local'
const FIXTURE_PASSWORD = 'TestCaregiver2026!'

const CLIENT = {
  firstName: 'TEST-Lok',
  lastName: 'TEST-Ghimeray',
  dateOfBirth: '1948-03-12',
  address: '225 National Dr, Pittsburgh PA 15235',
  geofenceRadiusMeters: 150,
  // 225 National Dr, Pittsburgh, PA 15235 (approximate)
  latitude: 40.4659,
  longitude: -79.8358,
}

const CAREGIVER = {
  firstName: 'TEST-Roman',
  lastName: 'TEST-Ghimeray',
}

const VISIT_TEMPLATE = {
  name: 'TEST DAILY PERSONAL CARE',
  tasks: [
    { id: 'bathing', label: 'Bathing assistance' },
    { id: 'dressing', label: 'Dressing assistance' },
    { id: 'meal-prep', label: 'Meal preparation' },
    { id: 'medication-reminder', label: 'Medication reminders' },
    { id: 'mobility', label: 'Ambulation / mobility support' },
  ],
}

// ---------- Guards ----------

const PROD_HOST_FRAGMENTS: readonly string[] = [
  'rayhealthevv.com',
  'late-art-87716813', // Neon project id — default branch
]

function assertNonProdDatabaseUrl(url: string | undefined): asserts url is string {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Refusing to run seed without an explicit, non-prod database URL.',
    )
  }

  for (const fragment of PROD_HOST_FRAGMENTS) {
    if (url.includes(fragment) && !url.includes('branch=')) {
      throw new Error(
        `Refusing to seed: DATABASE_URL contains production fragment "${fragment}" without a "branch=" parameter. ` +
          'Target a Neon branch (e.g. branch=app-store-screenshots) before re-running.',
      )
    }
  }

  if (!url.includes('branch=')) {
    throw new Error(
      'Refusing to seed: DATABASE_URL must include a "branch=" parameter to confirm a non-default Neon branch target.',
    )
  }
}

// ---------- Password hashing ----------
// Matches the platform's bcryptjs auth path (see packages/app/src/routes/auth-routes.ts).
// Cost factor 10 — same as the rest of the app's password hashing.

async function hashFixturePassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// ---------- Idempotent inserts ----------

interface ExistsResult {
  exists: boolean
}

async function rowExists(db: Knex, table: string, id: string): Promise<boolean> {
  const result = (await db(table).where({ id }).first()) as ExistsResult | undefined
  return Boolean(result)
}

interface SeedSummary {
  agency: 'created' | 'exists'
  client: 'created' | 'exists'
  caregiver: 'created' | 'exists'
  user: 'created' | 'exists'
  visitTemplate: 'created' | 'exists'
  assignment: 'created' | 'exists'
}

async function seedAgency(db: Knex): Promise<'created' | 'exists'> {
  if (await rowExists(db, 'agencies', AGENCY_ID)) return 'exists'
  await db('agencies').insert({
    id: AGENCY_ID,
    name: 'TEST Fixture Agency',
    state: 'PA',
    operating_tracks: JSON.stringify(['personal_care']),
    medicaid_provider_number: 'TEST-PROVIDER',
  })
  return 'created'
}

async function seedClient(db: Knex): Promise<'created' | 'exists'> {
  if (await rowExists(db, 'clients', CLIENT_ID)) return 'exists'
  await db('clients').insert({
    id: CLIENT_ID,
    agency_id: AGENCY_ID,
    first_name: CLIENT.firstName,
    last_name: CLIENT.lastName,
    date_of_birth: CLIENT.dateOfBirth,
    medicaid_number: null,
  })
  return 'created'
}

async function seedCaregiver(db: Knex): Promise<'created' | 'exists'> {
  if (await rowExists(db, 'caregivers', CAREGIVER_ID)) return 'exists'
  await db('caregivers').insert({
    id: CAREGIVER_ID,
    agency_id: AGENCY_ID,
    first_name: CAREGIVER.firstName,
    last_name: CAREGIVER.lastName,
    email: FIXTURE_EMAIL,
    phone: null,
    npi: null,
    hire_date: null,
    status: 'active',
  })
  return 'created'
}

async function seedUser(db: Knex): Promise<'created' | 'exists'> {
  if (await rowExists(db, 'users', CAREGIVER_USER_ID)) return 'exists'
  const passwordHash = await hashFixturePassword(FIXTURE_PASSWORD)
  await db('users').insert({
    id: CAREGIVER_USER_ID,
    agency_id: AGENCY_ID,
    email: FIXTURE_EMAIL.toLowerCase(),
    password_hash: passwordHash,
    role: 'caregiver',
    caregiver_id: CAREGIVER_ID,
  })
  return 'created'
}

async function seedVisitTemplate(db: Knex): Promise<'created' | 'exists'> {
  if (await rowExists(db, 'visit_templates', VISIT_TEMPLATE_ID)) return 'exists'
  await db('visit_templates').insert({
    id: VISIT_TEMPLATE_ID,
    client_id: CLIENT_ID,
    name: VISIT_TEMPLATE.name,
    tasks: JSON.stringify(VISIT_TEMPLATE.tasks),
  })
  return 'created'
}

async function seedAssignment(db: Knex): Promise<'created' | 'exists'> {
  if (await rowExists(db, 'assignments', ASSIGNMENT_ID)) return 'exists'
  await db('assignments').insert({
    id: ASSIGNMENT_ID,
    caregiver_id: CAREGIVER_ID,
    visit_template_id: VISIT_TEMPLATE_ID,
  })
  return 'created'
}

// ---------- Main ----------

async function main(): Promise<void> {
  assertNonProdDatabaseUrl(process.env.DATABASE_URL)

  const db = createDb()
  try {
    const summary: SeedSummary = await db.transaction(async (trx) => {
      const agency = await seedAgency(trx)
      const client = await seedClient(trx)
      const caregiver = await seedCaregiver(trx)
      const user = await seedUser(trx)
      const visitTemplate = await seedVisitTemplate(trx)
      const assignment = await seedAssignment(trx)
      return { agency, client, caregiver, user, visitTemplate, assignment }
    })

    // Intentional stdout — this is a CLI script and its output IS the product.
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          summary,
          fixture: {
            agencyId: AGENCY_ID,
            clientId: CLIENT_ID,
            caregiverId: CAREGIVER_ID,
            userId: CAREGIVER_USER_ID,
            visitTemplateId: VISIT_TEMPLATE_ID,
            assignmentId: ASSIGNMENT_ID,
            email: FIXTURE_EMAIL,
            // Password is documented in docs/SESSION_HANDOFF_2026-05-09.md; not echoed here.
          },
        },
        null,
        2,
      ) + '\n',
    )
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  process.stderr.write(`seed-app-store-fixture: ${message}\n`)
  process.exit(1)
})
