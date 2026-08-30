import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_EVENTS = new Set([
  'kit_viewed', 'video_played', 'video_25_percent', 'video_50_percent',
  'video_75_percent', 'video_completed', 'download_hd_clicked',
  'download_mobile_clicked', 'caption_copied', 'code_copied',
  'hashtags_copied', 'platform_opened', 'post_url_submitted',
  'customization_requested', 'angle_changed', 'help_clicked',
])

// POST /api/partner/repost/events — batch insert tracking events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, events } = body as {
      sessionId: string
      events: { event_type: string; metadata?: Record<string, unknown>; occurred_at: string }[]
    }

    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify session exists
    const { data: session } = await admin
      .from('repost_kit_sessions' as never)
      .select('id')
      .eq('id' as never, sessionId as never)
      .single()

    if (!session) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    // Filter valid events and batch insert
    const validEvents = events
      .filter(e => VALID_EVENTS.has(e.event_type))
      .slice(0, 50) // Cap at 50 per batch
      .map(e => ({
        session_id: sessionId,
        event_type: e.event_type,
        metadata: e.metadata ?? null,
        occurred_at: e.occurred_at || new Date().toISOString(),
      }))

    if (validEvents.length > 0) {
      await admin.from('repost_kit_events' as never).insert(validEvents as never)
    }

    // Touch session last_activity_at
    const { error: touchErr } = await admin
      .from('repost_kit_sessions' as never)
      .update({ last_activity_at: new Date().toISOString() } as never)
      .eq('id' as never, sessionId as never)
    if (touchErr) console.error('[repost/events] touch last_activity_at error:', touchErr)

    return NextResponse.json({ ok: true, count: validEvents.length })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
