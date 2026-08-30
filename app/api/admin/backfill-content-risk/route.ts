import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/is-admin'
import { detectContentRisk } from '@/lib/scoring/content-risk'

/**
 * POST /api/admin/backfill-content-risk
 * One-shot backfill: apply keyword detection to all existing trending_clips.
 * Processes in batches of 500. Admin-only.
 */
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminUser(supabase, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  let processed = 0
  let flagged = 0
  let offset = 0
  const batchSize = 500

  while (true) {
    const { data: clips, error } = await (admin
      .from('trending_clips')
      .select('id, title, niche, streamer_id' as '*')
      .is('content_risk' as never, null)
      .range(offset, offset + batchSize - 1) as unknown as Promise<{ data: { id: string; title: string | null; niche: string | null; streamer_id: string | null }[] | null; error: { message: string } | null }>)

    if (error) {
      return NextResponse.json({ error: error.message, processed, flagged }, { status: 500 })
    }
    if (!clips || clips.length === 0) break

    // Batch lookup streamer niches + content_risk
    const streamerIds = [...new Set(clips.map(c => c.streamer_id).filter(Boolean))]
    const streamerMap = new Map<string, { niche: string | null; content_risk: string | null }>()
    if (streamerIds.length > 0) {
      const { data: streamers } = await (admin
        .from('streamers')
        .select('id, niche, content_risk' as '*')
        .in('id', streamerIds as string[]) as unknown as Promise<{ data: { id: string; niche: string | null; content_risk: string | null }[] | null }>)
      for (const s of streamers ?? []) {
        streamerMap.set(s.id, { niche: s.niche, content_risk: s.content_risk ?? null })
      }
    }

    for (const clip of clips) {
      const streamer = clip.streamer_id ? streamerMap.get(clip.streamer_id) : null
      const risk = detectContentRisk(clip.title, streamer?.niche, streamer?.content_risk)
      if (risk) {
        await admin
          .from('trending_clips')
          .update({ content_risk: risk } as never)
          .eq('id', clip.id)
        flagged++
      }
      processed++
    }

    if (clips.length < batchSize) break
    offset += batchSize
  }

  return NextResponse.json({
    data: { processed, flagged },
    error: null,
    message: `Backfill complete: ${flagged}/${processed} clips flagged`,
  })
}
