#!/usr/bin/env npx tsx
/**
 * Check Migrations — compares local supabase/migrations/*.sql files
 * against the migrations actually applied in the database
 * (supabase_migrations.schema_migrations table).
 *
 * Usage:  npx tsx scripts/check-migrations.ts
 * Exit:   0 = all applied, 1 = missing migrations found
 *
 * Add to nightly audit: scripts/audits/run-nightly.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  console.log('=== Migration Check ===\n')

  // 1. List local migration files
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
  if (!fs.existsSync(migrationsDir)) {
    console.error('supabase/migrations/ directory not found')
    process.exit(1)
  }

  const localFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`Local migration files: ${localFiles.length}`)

  // 2. Fetch applied migrations from DB
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL or service key not set — cannot query DB')
    console.log('\nLocal files (unverified):')
    localFiles.forEach(f => console.log(`  ${f}`))
    process.exit(1)
  }

  let appliedVersions: Set<string>
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/schema_migrations?select=version&order=version`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!res.ok) {
      // Try the supabase_migrations schema
      const res2 = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_applied_migrations`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
          signal: AbortSignal.timeout(10000),
        },
      )

      if (!res2.ok) {
        const text = await res.text()
        console.error(`Cannot query schema_migrations: ${res.status} ${text.slice(0, 200)}`)
        console.log('\nFalling back to file-only listing:')
        localFiles.forEach(f => console.log(`  ${f}`))
        process.exit(1)
      }

      const data2 = await res2.json()
      appliedVersions = new Set((data2 as Array<{ version: string }>).map(r => r.version))
    } else {
      const data = await res.json()
      appliedVersions = new Set((data as Array<{ version: string }>).map(r => r.version))
    }
  } catch (err) {
    console.error(`DB query failed: ${(err as Error).message}`)
    console.log('\nLocal files (unverified):')
    localFiles.forEach(f => console.log(`  ${f}`))
    process.exit(1)
  }

  console.log(`Applied migrations in DB: ${appliedVersions.size}`)

  // 3. Compare: extract version (timestamp prefix) from filename
  // Migration filenames: 20260601_acquisition_discovery_tables.sql → version = "20260601_acquisition_discovery_tables"
  // Or: 20240101000000_init_schema.sql → version = "20240101000000_init_schema"
  const missing: string[] = []
  const applied: string[] = []

  for (const file of localFiles) {
    const version = file.replace(/\.sql$/, '')
    if (appliedVersions.has(version)) {
      applied.push(file)
    } else {
      missing.push(file)
    }
  }

  // Also check for DB migrations not in local files (orphaned)
  const localVersions = new Set(localFiles.map(f => f.replace(/\.sql$/, '')))
  const orphaned = [...appliedVersions].filter(v => !localVersions.has(v))

  console.log(`Applied: ${applied.length}`)
  console.log(`Missing (not applied): ${missing.length}`)
  if (orphaned.length > 0) console.log(`Orphaned (in DB, not in files): ${orphaned.length}`)

  if (missing.length > 0) {
    console.log('\n--- MISSING MIGRATIONS (need to be applied) ---')
    missing.forEach(f => console.log(`  ! ${f}`))
  }

  if (orphaned.length > 0) {
    console.log('\n--- ORPHANED (in DB but no local file) ---')
    orphaned.forEach(v => console.log(`  ? ${v}`))
  }

  if (missing.length === 0 && orphaned.length === 0) {
    console.log('\nAll migrations are in sync.')
  }

  console.log('\n=== Done ===')
  process.exit(missing.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
