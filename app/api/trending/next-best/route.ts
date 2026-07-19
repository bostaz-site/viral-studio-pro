import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/trending/next-best?exclude=clipId
 * Returns the next best trending clip not yet rendered by this user.
 * Used by the chain farming UX after banking a clip.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const excludeClipId = req.nextUrl.searchParams.get('exclude') ?? ''

  try {
    const admin = createAdminClient()

    // Get clip IDs this user has already rendered
    const { data: renderedJobs } = await admin
      .from('render_jobs')
      .select('clip_id')
      .eq('user_id', user.id)
      .in('status', ['done', 'pending', 'rendering'])

    const excludeIds = new Set(
      (renderedJobs ?? []).map((j: { clip_id: string }) => j.clip_id)
    )
    if (excludeClipId) excludeIds.add(excludeClipId)

    // Fetch top clips by velocity_score, filter out already-rendered ones
    const { data: clips } = await admin
      .from('trending_clips')
      .select('id, external_url, platform, title, author_name, velocity_score, thumbnail_url, tier, view_count, duration_seconds')
      .gt('velocity_score', 0)
      .order('velocity_score', { ascending: false })
      .limit(20)

    const nextClip = (clips ?? []).find(
      (c: { id: string }) => !excludeIds.has(c.id)
    )

    if (!nextClip) {
      return NextResponse.json({ data: null })
    }

    return NextResponse.json({ data: nextClip })
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
