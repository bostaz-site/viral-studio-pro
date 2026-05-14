import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createAdminClient } from '@/lib/supabase/admin'

function extractVideoId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 2]
}

// GET /api/admin/video-library/[id]/performance — daily performance data
export const GET = withAdmin(async (req: NextRequest) => {
  const videoId = extractVideoId(req)
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('promo_video_performance_daily')
    .select('*')
    .eq('promo_video_id', videoId)
    .gte('date', since)
    .order('date', { ascending: true })

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  // Compute totals
  const totals = (data || []).reduce(
    (acc, d) => ({
      kits: acc.kits + (d.kits_generated || 0),
      views: acc.views + (d.kit_views || 0),
      completions: acc.completions + (d.video_completions || 0),
      copies: acc.copies + (d.code_copies || 0),
      posts: acc.posts + (d.posts_submitted || 0),
      signups: acc.signups + (d.signups_attributed || 0),
      revenue: acc.revenue + Number(d.revenue_cents || 0),
    }),
    { kits: 0, views: 0, completions: 0, copies: 0, posts: 0, signups: 0, revenue: 0 },
  )

  return NextResponse.json({
    data: { daily: data || [], totals, days },
    error: null,
  })
})
