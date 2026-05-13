import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  sessionId: z.string().uuid(),
  postUrl: z.string().url().max(500),
})

// POST /api/partner/repost/submit — submit post URL after reposting
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { sessionId, postUrl } = parsed.data
    const admin = createAdminClient()

    // Update session with post URL
    const { error } = await admin
      .from('repost_kit_sessions' as never)
      .update({
        post_url: postUrl,
        post_submitted_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      } as never)
      .eq('id' as never, sessionId as never)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Also log as event
    await admin.from('repost_kit_events' as never).insert({
      session_id: sessionId,
      event_type: 'post_url_submitted',
      metadata: { post_url: postUrl },
      occurred_at: new Date().toISOString(),
    } as never)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
