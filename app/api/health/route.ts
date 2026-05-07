import { NextResponse } from 'next/server'

async function checkSupabase(): Promise<'ok' | 'error'> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return 'error'
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

async function checkRedis(): Promise<'ok' | 'error'> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return 'error'
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

async function checkVps(): Promise<'ok' | 'error'> {
  try {
    const url = process.env.VPS_RENDER_URL
    if (!url) return 'error'
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return data.status === 'healthy' ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

export async function GET() {
  const checks = {
    db: await checkSupabase(),
    redis: await checkRedis(),
    vps: await checkVps(),
  }

  const healthy = Object.values(checks).every(c => c === 'ok')

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}
