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
import { checkAnalysisGate } from '@/lib/distribution/analysis-gate'
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
  const cronSecret = process.env.CRON_SECRET
  if (!apiKey || !cronSecret || !(await import('@/lib/crypto')).timingSafeCompare(apiKey, cronSecret)) {
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

    // 1b. Autofarm pause check (warmup / flagged account cooldown)
    {
      const { data: distSettings } = await (admin
        .from('distribution_settings')
        .select('autofarm_paused_until' as '*')
        .eq('user_id', row.user_id)
        .single() as unknown as Promise<{ data: { autofarm_paused_until: string | null } | null }>)

      const pausedUntil = distSettings?.autofarm_paused_until
      if (pausedUntil && new Date(pausedUntil) > new Date()) {
        await admin
          .from('scheduled_publications')
          .update({ status: 'canceled', error_message: `autofarm paused until ${pausedUntil}`, updated_at: new Date().toISOString() } as never)
          .eq('id', row.id)
        results.push({ id: row.id, status: 'canceled', error: 'autofarm_paused' })
        continue
      }
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

    // 2c. Guard: content risk — never auto-publish risky content unless user opted in
    if (row.clip_id) {
      const { data: clipRow } = await (admin
        .from('trending_clips')
        .select('content_risk' as '*')
        .eq('id', row.clip_id)
        .single() as unknown as Promise<{ data: { content_risk: string | null } | null }>)

      if (clipRow?.content_risk) {
        // Check if user allows risky content
        const { data: distSettings } = await admin
          .from('distribution_settings')
          .select('allow_risky_content')
          .eq('user_id', row.user_id)
          .single()

        const allowRisky = (distSettings as { allow_risky_content?: boolean } | null)?.allow_risky_content
        if (!allowRisky) {
          await admin
            .from('scheduled_publications')
            .update({
              status: 'canceled',
              error_message: `content_risk=${clipRow.content_risk} — auto-publish blocked`,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', row.id)

          results.push({ id: row.id, status: 'canceled', error: 'content_risk_blocked' })
          continue
        }
      }
    }

    // 2d. Quality gate: TikTok originality policy (Sept 2025) — subtitles alone
    //     don't count as transformation. Autofarm requires ALL 3 features applied
    //     (hook_text + captions + smart_zoom = transform_score 3), a diversify
    //     variant, no degraded status, and no source watermark leak.
    {
      const { data: renderJob } = await (admin
        .from('render_jobs')
        .select('id, status, transform_score, contract, render_settings' as '*')
        .eq('clip_id', row.clip_id)
        .eq('user_id', row.user_id)
        .in('status', ['done', 'degraded'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as unknown as Promise<{ data: { id: string; status: string; transform_score: number | null; contract: unknown; render_settings: unknown } | null }>)

      // Gate 1: degraded renders never auto-published
      if (renderJob?.status === 'degraded') {
        await admin
          .from('scheduled_publications')
          .update({ status: 'canceled', error_message: 'render degraded — not safe for auto-publish', updated_at: new Date().toISOString() } as never)
          .eq('id', row.id)
        results.push({ id: row.id, status: 'canceled', error: 'render_degraded' })
        continue
      }

      // Gate 2: autofarm requires transform_score = 3 (all 3 features)
      const score = renderJob?.transform_score ?? null
      if (score !== null && score < 3) {
        const msg = `transform_score=${score}/3 — autofarm requires hook + captions + smart zoom`
        await admin
          .from('scheduled_publications')
          .update({ status: 'canceled', error_message: msg, updated_at: new Date().toISOString() } as never)
          .eq('id', row.id)
        results.push({ id: row.id, status: 'canceled', error: 'transform_score_too_low' })
        continue
      }

      // Gate 3: must have a diversify variant (jobId-based diversification)
      if (renderJob) {
        const { count: variantCount } = await (admin
          .from('render_variants' as never)
          .select('id', { count: 'exact', head: true })
          .eq('render_job_id', renderJob.id) as unknown as Promise<{ count: number | null }>)
        if (!variantCount || variantCount === 0) {
          const msg = 'no diversify variant — autofarm requires platform-specific encoding'
          await admin
            .from('scheduled_publications')
            .update({ status: 'canceled', error_message: msg, updated_at: new Date().toISOString() } as never)
            .eq('id', row.id)
          results.push({ id: row.id, status: 'canceled', error: 'no_variant' })
          continue
        }
      }

      // Gate 4: source watermark leak — fullframe on Kick/Twitch without sufficient borderCrop
      if (renderJob && Array.isArray(renderJob.contract)) {
        const cropEntry = (renderJob.contract as { feature: string; applied: boolean; meta?: { actual_mode?: string; borderCropPx?: number }; reason?: string }[])
          .find(e => e.feature === 'crop_mode')
        const actualMode = cropEntry?.meta?.actual_mode ?? ''
        const borderCrop = cropEntry?.meta?.borderCropPx ?? 0
        const sourcePlatform = (renderJob.render_settings as { sourcePlatform?: string } | null)?.sourcePlatform ?? ''
        const isStreamPlatform = ['twitch', 'kick'].includes(sourcePlatform)
        if (isStreamPlatform && actualMode === 'fullframe' && borderCrop < 40) {
          const msg = `source watermark visible — ${sourcePlatform} fullframe with borderCrop=${borderCrop}px (<40)`
          console.warn(`[publish-scheduled] watermark gate blocked ${row.id}: ${msg}`)
          await admin
            .from('scheduled_publications')
            .update({ status: 'canceled', error_message: msg, updated_at: new Date().toISOString() } as never)
            .eq('id', row.id)
          results.push({ id: row.id, status: 'canceled', error: 'source_watermark_visible' })
          continue
        }
      }

      // Gate 5: 4-criteria analysis gate
      const analysisGate = checkAnalysisGate(renderJob)
      if (!analysisGate.eligible) {
        console.warn(`[publish-scheduled] analysis gate blocked ${row.id} (clip ${row.clip_id}): ${analysisGate.reason}`)
        await admin
          .from('scheduled_publications')
          .update({ status: 'canceled', error_message: analysisGate.reason, updated_at: new Date().toISOString() } as never)
          .eq('id', row.id)
        results.push({ id: row.id, status: 'canceled', error: 'analysis_criteria_too_low' })
        continue
      }
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
      seed: row.id, // P4 caption diversification seed (+ excludes this row from duplicate check)
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
        .in('status', ['done', 'degraded'])

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
      const currentRetries = row.retry_count ?? 0
      const maxRetries = 2

      if (currentRetries < maxRetries) {
        const retryCount = currentRetries + 1
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
            retry_count: currentRetries,
            error_message: result.error ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', row.id)

        results.push({ id: row.id, status: 'failed', error: result.error })

        void postToDiscord({
          channel: 'stripe-events',
          embed: {
            title: '❌ Auto-post failed',
            description: `${result.error?.slice(0, 200)} (${currentRetries} retries)`,
            color: 0xef4444,
          },
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
