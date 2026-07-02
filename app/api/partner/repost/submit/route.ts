import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { postToDiscord } from '@/lib/discord/post'

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

    // ── Post-submit side effects (each independent, never fail the submit) ──

    // Fetch session to get influencer_id + promo_video_id
    const { data: session } = await admin
      .from('repost_kit_sessions' as never)
      .select('influencer_id, promo_video_id')
      .eq('id' as never, sessionId as never)
      .single()

    const influencerId = (session as { influencer_id: string } | null)?.influencer_id
    const promoVideoId = (session as { promo_video_id: string | null } | null)?.promo_video_id

    if (influencerId) {
      // (a) Update video_assignment_log posted_at (Match Engine KPI)
      if (promoVideoId) {
        try {
          await admin
            .from('video_assignment_log')
            .update({ posted_at: new Date().toISOString() })
            .eq('influencer_id', influencerId)
            .eq('promo_video_id', promoVideoId)
            .is('posted_at', null)
        } catch { /* non-blocking */ }
      }

      // (b) Update generated_offers status → 'posted'
      try {
        await admin
          .from('generated_offers')
          .update({ status: 'posted' })
          .eq('influencer_id', influencerId)
          .in('status', ['sent', 'opened', 'replied'])
          .order('created_at', { ascending: false })
          .limit(1)
      } catch { /* non-blocking */ }

      // (c) Advance influencer status to 'onboarded' (anti-retrogradation guard)
      try {
        const { data: inf } = await admin
          .from('influencers')
          .select('status, platform_handle, display_name')
          .eq('id', influencerId)
          .single()

        const currentStatus = (inf as { status: string } | null)?.status
        const promotableStatuses = ['replied', 'interested', 'demo_sent', 'evaluating']
        if (currentStatus && promotableStatuses.includes(currentStatus)) {
          await admin
            .from('influencers')
            .update({
              status: 'onboarded',
              last_active_at: new Date().toISOString(),
            })
            .eq('id', influencerId)
        } else if (currentStatus) {
          // Just update last_active_at without changing status
          await admin
            .from('influencers')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', influencerId)
        }

        // (d) Discord notification
        const handle = (inf as { platform_handle: string | null } | null)?.platform_handle
          || (inf as { display_name: string | null } | null)?.display_name
          || 'Unknown'
        try {
          await postToDiscord({
            channel: 'conversions',
            embed: {
              title: '\uD83C\uDF89 Repost submitted!',
              description: `**${handle}** posted the video.`,
              color: 0x22c55e, // green-500
              fields: [
                { name: 'Post URL', value: postUrl, inline: false },
                { name: 'Status', value: currentStatus ? `${currentStatus} \u2192 onboarded` : 'updated', inline: true },
              ],
            },
          })
        } catch { /* non-blocking */ }
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
