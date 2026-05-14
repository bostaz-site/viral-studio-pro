import { z } from 'zod'
import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { autoAssignVideo, batchAutoAssign } from '@/lib/admin/match-engine/auto-assigner'

// POST — compute matches (single or batch)
export const POST = withAdmin(async (req) => {
  const body = await req.json()

  if (body.influencerId) {
    const parsed = z.object({ influencerId: z.string().uuid() }).safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)
    return jsonResponse(await autoAssignVideo(parsed.data.influencerId))
  }

  if (body.influencerIds) {
    const parsed = z.object({ influencerIds: z.array(z.string().uuid()).min(1).max(200) }).safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)
    const results = await batchAutoAssign(parsed.data.influencerIds)
    return jsonResponse({ total: results.length, matched: results.filter(r => r.matchedVideoId).length, fallbacks: results.filter(r => r.isFallback).length, results })
  }

  return errorResponse('influencerId or influencerIds required')
})

// GET — get matches for an influencer
export const GET = withAdmin(async (req: NextRequest) => {
  const influencerId = new URL(req.url).searchParams.get('influencerId')
  if (!influencerId) return errorResponse('influencerId required')

  const admin = createAdminClient()
  const { data } = await admin
    .from('video_influencer_matches' as never)
    .select('*')
    .eq('influencer_id' as never, influencerId as never)
    .order('match_score' as never, { ascending: false } as never)
    .limit(10)

  return jsonResponse(data ?? [])
})
