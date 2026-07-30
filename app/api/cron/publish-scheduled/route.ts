/**
 * Cron: publish-scheduled — executes due autofarm publications.
 * Schedule: every 5-10 min via Railway/cron-job.org
 * Auth: x-api-key = CRON_SECRET
 *
 * Flow:
 * 1. SELECT scheduled_publications WHERE status='scheduled' AND scheduled_at <= now() LIMIT 5
 * 2. Optimistic lock: UPDATE status='publishing' WHERE status='scheduled' (skip if 0 rows)
 * 3. Execute publish via shared execute-publish.ts
 * 4. Success → status='published' | Failure → status='failed' + retry logic
 * 5. Discord notification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executePublish } from '@/lib/distribution/execute-publish'
import { postToDiscord } from '@/lib/discord/post'

export const dynamic = 'force-dynamic'

// Row type — includes columns added by migration but not yet in generated types
interface ScheduledRow {
  id: string
  user_id: string
  clip_id: string
  platform: string
  caption: string | null
  hashtags: string[] | null
  scheduled_at: string
  status: string
  tiktok_options: Record<string, unknown> | null
  retry_count: number
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1. Find due publications
  const { data: dueRows, error: fetchError } = await (admin
    .from('scheduled_publications')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5) as unknown as Promise<{ data: ScheduledRow[] | null; error: { message: string } | null }>)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!dueRows || dueRows.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No due publications' })
  }

  const results: Array<{ id: string; status: string; error?: string }> = []

  for (const row of dueRows) {
    if (!row.user_id) {
      results.push({ id: row.id, status: 'skipped', error: 'No user_id' })
      continue
    }

    // 2. Optimistic lock: SET status='publishing' WHERE status='scheduled'
    const { data: locked } = await admin
      .from('scheduled_publications')
      .update({ status: 'publishing', updated_at: new Date().toISOString() } as never)
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('id')

    if (!locked || locked.length === 0) {
      results.push({ id: row.id, status: 'skipped' })
      continue
    }

    // 2b. Guard: if already published manually, cancel instead of publishing
    const { data: alreadyPublished } = await admin
      .from('published_posts')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('clip_id', row.clip_id)
      .eq('platform', row.platform)
      .limit(1)

    if (alreadyPublished && alreadyPublished.length > 0) {
      await admin
        .from('scheduled_publications')
        .update({
          status: 'canceled',
          error_message: 'already published manually',
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id)

      results.push({ id: row.id, status: 'canceled', error: 'already published manually' })
      continue
    }

    // 3. Execute publish
    const tiktokOptions = row.tiktok_options as {
      privacy_level: string
      disable_comment: boolean
      disable_duet: boolean
      disable_stitch: boolean
      brand_content_toggle?: boolean
      brand_organic_toggle?: boolean
    } | null

    const result = await executePublish({
      userId: row.user_id,
      clipId: row.clip_id,
      platform: row.platform,
      caption: row.caption ?? '',
      hashtags: row.hashtags ?? [],
      tiktokOptions: tiktokOptions,
    })

    if (result.success) {
      // 4a. Success
      await admin
        .from('scheduled_publications')
        .update({
          status: 'published',
          publish_result: { post_id: result.postId },
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id)

      // Remove clip from bank to prevent republish loop
      await admin
        .from('render_jobs')
        .update({ removed_from_bank_at: new Date().toISOString() } as never)
        .eq('clip_id', row.clip_id)
        .eq('user_id', row.user_id)
        .eq('status', 'done')

      results.push({ id: row.id, status: 'published' })

      void postToDiscord({
        channel: 'stripe-events',
        embed: {
          title: '🚀 Auto-posted to TikTok',
          description: (row.caption ?? 'untitled').slice(0, 200),
          color: 0x22d3ee,
        },
      }).catch(() => {})
    } else {
      // 4b. Failure — retry logic
      const retryCount = (row.retry_count ?? 0) + 1
      const maxRetries = 2

      if (retryCount < maxRetries) {
        const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
        await admin
          .from('scheduled_publications')
          .update({
            status: 'scheduled',
            scheduled_at: retryAt,
            retry_count: retryCount,
            error_message: result.error ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', row.id)

        results.push({ id: row.id, status: 'retry', error: result.error })
      } else {
        await admin
          .from('scheduled_publications')
          .update({
            status: 'failed',
            retry_count: retryCount,
            error_message: result.error ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', row.id)

        results.push({ id: row.id, status: 'failed', error: result.error })

        void postToDiscord({
          channel: 'stripe-events',
          embed: {
            title: '❌ Auto-post failed',
            description: `${result.error?.slice(0, 200)} (${retryCount} retries)`,
            color: 0xef4444,
          },
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
