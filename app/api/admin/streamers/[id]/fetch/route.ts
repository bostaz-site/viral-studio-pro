import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAndScoreStreamerClips } from '@/lib/twitch/fetch-streamer-clips'
import { fetchAndScoreKickClips } from '@/lib/kick/fetch-kick-clips'

// POST: Trigger immediate fetch for a specific streamer
export const POST = withAdmin(async (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  // path: /api/admin/streamers/[id]/fetch → id is at -2
  const id = segments[segments.length - 2]
  if (!id) return errorResponse('id is required')

  const supabase = createAdminClient()

  const { data: streamer, error } = await supabase
    .from('streamers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !streamer) return errorResponse('Streamer not found', 404)

  const results: Record<string, unknown> = {}

  // Fetch Twitch if applicable
  if (streamer.twitch_login) {
    const twitchResult = await fetchAndScoreStreamerClips(supabase, 48, 20)
    results.twitch = twitchResult
  }

  // Fetch Kick if applicable
  if (streamer.kick_login) {
    const kickResult = await fetchAndScoreKickClips(supabase, 20)
    results.kick = kickResult
  }

  // Update last_fetched_at
  await supabase
    .from('streamers')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', id)

  return jsonResponse(results)
})
