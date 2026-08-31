#!/usr/bin/env npx tsx
/**
 * Meta App Review — Instagram API test calls
 *
 * Exercises the two permissions needed for App Review:
 *   1. instagram_business_basic     → GET /me, GET /me/media
 *   2. instagram_business_content_publish → POST container + publish Reel
 *
 * Token : INSTAGRAM_TEST_ACCESS_TOKEN (.env.local)
 * Account: @samycloutier30 — IG user ID 17841413453773071
 *
 * Usage:  npx tsx scripts/meta/test-instagram-api.ts
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
// Also load .env for vars that may only be there
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
import { createClient } from '@supabase/supabase-js'

// ── Config ───────────────────────────────────────────────────────────────────

const TOKEN = process.env.INSTAGRAM_TEST_ACCESS_TOKEN
if (!TOKEN) {
  console.error('INSTAGRAM_TEST_ACCESS_TOKEN not set in .env.local — aborting')
  process.exit(1)
}

const IG_USER_ID = '17841413453773071'
const API_VERSION = 'v21.0'
const BASE = `https://graph.instagram.com/${API_VERSION}`

// ── Helpers ──────────────────────────────────────────────────────────────────

async function metaCall(
  label: string,
  method: string,
  url: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  console.log(`\n  ${method} ${url.replace(TOKEN!, '<TOKEN>').substring(0, 120)}...`)
  try {
    const opts: RequestInit = { method }
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' }
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(url, opts)
    const data = (await res.json()) as Record<string, unknown>

    if (!res.ok || data.error) {
      const err = data.error as Record<string, unknown> | undefined
      console.error(`  FAIL [${res.status}]`, JSON.stringify(err ?? data, null, 2))
      return { ok: false, data }
    }
    console.log(`  OK [${res.status}]`, JSON.stringify(data, null, 2))
    return { ok: true, data }
  } catch (err) {
    console.error(`  NETWORK ERROR:`, (err as Error).message)
    return { ok: false, data: { error: (err as Error).message } }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log('  Instagram API Test — Meta App Review')
  console.log('='.repeat(60))
  console.log(`  API:     ${BASE}`)
  console.log(`  User ID: ${IG_USER_ID}`)
  console.log(`  Date:    ${new Date().toISOString()}`)
  console.log()

  // ─── 1. GET /me (instagram_business_basic) ─────────────────────────────

  console.log('── 1. GET /me  (instagram_business_basic) ──')
  const me = await metaCall(
    '/me',
    'GET',
    `${BASE}/me?fields=user_id,username,account_type,followers_count,media_count&access_token=${TOKEN}`,
  )

  // ─── 2. GET /me/media ──────────────────────────────────────────────────

  console.log('\n── 2. GET /me/media  (instagram_business_basic) ──')
  const media = await metaCall(
    '/me/media',
    'GET',
    `${BASE}/me/media?fields=id,caption,media_type,timestamp&limit=5&access_token=${TOKEN}`,
  )

  // ─── 3. Publish a Reel (instagram_business_content_publish) ────────────

  console.log('\n── 3. Publish Reel  (instagram_business_content_publish) ──')

  // 3.0 — Get a public video URL
  // Priority: CLI arg → Supabase signed URL → abort
  let videoUrl: string | null = process.argv[2] ?? null

  if (!videoUrl) {
    // Generate a signed URL via Supabase Storage REST API.
    // Supports both legacy service_role key and new secret key (sb_secret_*).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    // Known recent render (fallback — update if stale)
    const storagePath = 'trending/14a567b4-928b-4318-94f0-ddde049c28db_1788202137224.mp4'

    if (supabaseUrl && supabaseKey) {
      try {
        const sb = createClient(supabaseUrl, supabaseKey)
        const { data: signed } = await sb.storage
          .from('clips')
          .createSignedUrl(storagePath, 3600)
        videoUrl = signed?.signedUrl ?? null
        if (videoUrl) console.log(`  Signed URL from Supabase Storage`)
      } catch (e) {
        console.warn(`  Supabase signed URL failed: ${(e as Error).message}`)
      }
    }
  }

  if (!videoUrl) {
    console.error('  No video URL available.')
    console.error('  Usage: npx tsx scripts/meta/test-instagram-api.ts <PUBLIC_VIDEO_URL>')
    console.error('  Provide a publicly accessible 9:16 MP4 URL as argument.')
    wrapUp()
    return
  }
  console.log(`  video URL: ${videoUrl.substring(0, 90)}...`)

  // 3a — Create Reel container
  console.log('\n  3a. Create Reel container')
  const container = await metaCall(
    'create-container',
    'POST',
    `${BASE}/${IG_USER_ID}/media`,
    {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: 'Test API Viral Animal \ud83d\udc3a #test',
      share_to_feed: true,
      access_token: TOKEN,
    },
  )

  if (!container.ok || !container.data.id) {
    console.error('  Container creation failed — stopping Reel test')
    wrapUp()
    return
  }

  const containerId = container.data.id as string
  console.log(`  Container ID: ${containerId}`)

  // 3b — Poll until FINISHED (max 120s)
  console.log('\n  3b. Polling container status...')
  const deadline = Date.now() + 120_000
  let lastStatus = 'IN_PROGRESS'

  while (Date.now() < deadline) {
    await sleep(5_000)
    const poll = await metaCall(
      'poll-status',
      'GET',
      `${BASE}/${containerId}?fields=status_code,status&access_token=${TOKEN}`,
    )
    if (!poll.ok) break

    lastStatus = (poll.data.status_code as string) ?? 'UNKNOWN'
    if (lastStatus === 'FINISHED') break
    if (lastStatus === 'ERROR') {
      console.error('  Container ERROR:', poll.data.status)
      wrapUp()
      return
    }
  }

  if (lastStatus !== 'FINISHED') {
    console.error(`  Timed out — last status: ${lastStatus}`)
    wrapUp()
    return
  }

  // 3c — Publish
  console.log('\n  3c. Publish container')
  const pub = await metaCall(
    'publish',
    'POST',
    `${BASE}/${IG_USER_ID}/media_publish`,
    {
      creation_id: containerId,
      access_token: TOKEN,
    },
  )

  if (pub.ok) {
    console.log(`\n  Published! Media ID: ${pub.data.id}`)
  }

  wrapUp()
}

function wrapUp() {
  console.log('\n' + '='.repeat(60))
  console.log('  Done — check output above for per-call results')
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
