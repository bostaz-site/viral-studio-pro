import { NextRequest, NextResponse } from 'next/server'
import { timingSafeCompare } from '@/lib/crypto'
import { isAdminEmail } from '@/lib/auth/admin-emails'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health/env
 *
 * Diagnostic endpoint: checks presence and format of critical env vars.
 * Never exposes actual values — only reports missing or wrong-format keys.
 *
 * Auth: CRON_SECRET via x-api-key header, OR admin user session.
 *
 * IMPORTANT (Netlify deploy):
 * Every server-side env var MUST be set to "All scopes" in Netlify.
 * A variable scoped "Builds only" is invisible to functions and edge middleware,
 * causing silent 500s that are extremely hard to debug.
 */
export async function GET(req: NextRequest) {
  // Auth: cron secret OR admin session
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  let authorized = false

  if (apiKey && cronSecret && timingSafeCompare(apiKey, cronSecret)) {
    authorized = true
  }

  if (!authorized) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user && isAdminEmail(user.email)) {
        authorized = true
      }
    } catch {
      // Not logged in
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Define expected env vars with optional prefix checks ──

  const checks: Array<{
    name: string
    prefix?: string
    prefixLabel?: string
  }> = [
    // Stripe
    { name: 'STRIPE_SECRET_KEY',      prefix: 'sk_',    prefixLabel: 'sk_live_ or sk_test_' },
    { name: 'STRIPE_PRICE_PRO',       prefix: 'price_', prefixLabel: 'price_' },
    { name: 'STRIPE_PRICE_STUDIO',    prefix: 'price_', prefixLabel: 'price_' },
    { name: 'STRIPE_PRICE_PACK5',     prefix: 'price_', prefixLabel: 'price_' },
    { name: 'STRIPE_PRICE_PACK10',    prefix: 'price_', prefixLabel: 'price_' },
    { name: 'STRIPE_WEBHOOK_SECRET',  prefix: 'whsec_', prefixLabel: 'whsec_' },

    // Supabase (code reads these names, with fallbacks to older names)
    { name: 'SUPABASE_SECRET_KEY' },
    { name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' },

    // Infrastructure
    { name: 'VPS_RENDER_API_KEY' },
    { name: 'CRON_SECRET' },
    { name: 'UPSTASH_REDIS_REST_URL',   prefix: 'https://', prefixLabel: 'https://' },
    { name: 'UPSTASH_REDIS_REST_TOKEN' },

    // Platform APIs
    { name: 'TWITCH_CLIENT_ID' },
    { name: 'TWITCH_CLIENT_SECRET' },
    { name: 'TIKTOK_CLIENT_KEY' },
    { name: 'TIKTOK_CLIENT_SECRET' },

    // AI / LLMs
    { name: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', prefixLabel: 'sk-ant-' },
    { name: 'OPENAI_API_KEY',   prefix: 'sk-',     prefixLabel: 'sk-' },
  ]

  const missing: string[] = []
  const wrongFormat: string[] = []

  for (const check of checks) {
    const value = process.env[check.name]

    // Also check fallback names for Supabase
    const fallbackValue =
      check.name === 'SUPABASE_SECRET_KEY'
        ? (value ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
        : check.name === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
          ? (value ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
          : value

    if (!fallbackValue) {
      missing.push(check.name)
      continue
    }

    if (check.prefix && !fallbackValue.startsWith(check.prefix)) {
      wrongFormat.push(`${check.name} (expected prefix: ${check.prefixLabel})`)
    }
  }

  const ok = missing.length === 0 && wrongFormat.length === 0

  return NextResponse.json({ ok, missing, wrongFormat })
}
