#!/usr/bin/env npx tsx
/**
 * Seed gameplay_assets from files already in the Supabase Storage `gameplay/` bucket.
 * Lists all files in the bucket, inserts rows for any not yet in the table.
 *
 * Usage: npx tsx scripts/seed-gameplay-assets.ts
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

  // List files in gameplay/ bucket
  const { data: files, error: listErr } = await sb.storage.from('gameplay').list('', { limit: 100 })
  if (listErr) {
    console.error('Failed to list gameplay bucket:', listErr.message)
    process.exit(1)
  }

  if (!files || files.length === 0) {
    console.log('No files in gameplay/ bucket. Upload MP4 files first.')
    return
  }

  const mp4Files = files.filter(f => f.name.endsWith('.mp4'))
  console.log(`Found ${mp4Files.length} MP4 files in gameplay/ bucket`)

  // Get existing rows
  const { data: existing } = await sb.from('gameplay_assets').select('storage_path')
  const existingPaths = new Set((existing ?? []).map((r: { storage_path: string }) => r.storage_path))

  let inserted = 0
  for (const file of mp4Files) {
    const storagePath = file.name
    if (existingPaths.has(storagePath)) {
      console.log(`  skip: ${storagePath} (already in DB)`)
      continue
    }

    // Infer category from filename (e.g. parkour-1.mp4 → parkour)
    const category = storagePath.replace(/[-_]\d+\.mp4$/, '').replace(/\.mp4$/, '')

    const { error: insertErr } = await sb.from('gameplay_assets').insert({
      storage_path: storagePath,
      category: category || 'parkour',
      duration_s: 60, // default — update manually after probing
      license: 'CC0',
      active: true,
    })

    if (insertErr) {
      console.error(`  ERROR inserting ${storagePath}: ${insertErr.message}`)
    } else {
      console.log(`  inserted: ${storagePath} (category=${category})`)
      inserted++
    }
  }

  console.log(`\nDone: ${inserted} new assets inserted, ${mp4Files.length - inserted} skipped`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
