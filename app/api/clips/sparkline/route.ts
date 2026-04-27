// Caller: components/trending/trending-detail-modal.tsx (velocity sparkline graph)
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * GET /api/clips/sparkline?ids=uuid1,uuid2,uuid3
 * Returns the last 8 snapshots per clip for sparkline rendering.
 * Public endpoint (no auth needed — clip data is public).
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`data:${ip}`, RATE_LIMITS.data.limit, RATE_LIMITS.data.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  const idsParam = req.nextUrl.searchParams.get('ids')
  if (!idsParam) {
    return NextResponse.json({ data: null, error: 'Missing ids' }, { status: 400 })
  }

  const ids = idsParam.split(',').slice(0, 50)
  const admin = createAdminClient()

  const { data: snapshots, error } = await admin
    .from('clip_snapshots')
    .select('clip_id, view_count, captured_at')
    .in('clip_id', ids)
    .order('captured_at', { ascending: true })

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  // Group by clip_id, keep last 8 per clip
  const byClip = new Map<string, number[]>()

  for (const s of snapshots ?? []) {
    const arr = byClip.get(s.clip_id) ?? []
    arr.push(s.view_count)
    byClip.set(s.clip_id, arr)
  }

  const grouped: Record<string, number[]> = {}
  for (const [clipId, views] of byClip) {
    grouped[clipId] = views.slice(-8)
  }

  return NextResponse.json({ data: grouped, error: null })
}
