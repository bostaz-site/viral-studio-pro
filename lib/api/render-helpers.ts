import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkClipDuration, getPlanConfig, resolveEffectivePlan } from '@/lib/plans'
import { resolveTwitchClipFromUrlOrSlug } from '@/lib/twitch/resolve-clip-url'
import { withRetry } from '@/lib/utils/with-retry'
import type { RenderStatus } from '@/types/enums'
import { releaseJob } from '@/lib/render-queue'

// ── Resolve clip source (trending, user clips, uploads) ──

export interface ResolvedClip {
  videoUrl: string
  clipTitle: string | null
  clipDuration: number | null
  foundSource: 'trending' | 'clips'
  /** Extra metadata from trending_clips (for mood detection, etc.) */
  authorName?: string | null
  authorHandle?: string | null
  niche?: string | null
  /** Source platform ('twitch'|'kick') for trending clips, null for uploads */
  platform?: string | null
}

export async function resolveClip(
  admin: SupabaseClient,
  clipId: string,
  userId: string,
  preferredSource: 'trending' | 'clips',
): Promise<ResolvedClip | NextResponse> {
  let videoUrl: string | null = null
  let clipTitle: string | null = null
  let clipDuration: number | null = null
  let foundSource: 'trending' | 'clips' | null = null
  let authorName: string | null = null
  let authorHandle: string | null = null
  let niche: string | null = null
  let platform: string | null = null

  if (preferredSource === 'trending') {
    const { data: trendingClip } = await admin
      .from('trending_clips')
      .select('*')
      .eq('id', clipId)
      .single()

    if (trendingClip) {
      foundSource = 'trending'
      videoUrl = trendingClip.external_url
      clipTitle = trendingClip.title
      clipDuration = (trendingClip as Record<string, unknown>).duration_seconds as number | null
      authorName = trendingClip.author_name
      authorHandle = trendingClip.author_handle
      niche = trendingClip.niche
      platform = trendingClip.platform
    }
  }

  // Fallback: check user clips table
  if (!foundSource) {
    const { data: clip } = await admin
      .from('clips')
      .select('*, videos(storage_path, duration_seconds, title)')
      .eq('id', clipId)
      .eq('user_id', userId)
      .single()

    if (clip) {
      foundSource = 'clips'
      const video = (clip.videos as unknown) as {
        storage_path: string
        duration_seconds: number | null
        title: string | null
      } | null
      videoUrl = video?.storage_path ?? null
      clipTitle = video?.title ?? clip.title
      clipDuration = video?.duration_seconds ?? clip.duration_seconds
    }
  }

  // Fallback: check videos table directly (user-uploaded videos without a clips row)
  if (!foundSource) {
    const { data: video } = await admin
      .from('videos')
      .select('id, title, storage_path, duration_seconds')
      .eq('id', clipId)
      .eq('user_id', userId)
      .single()

    if (video) {
      foundSource = 'clips'
      const { data: signedData } = await admin.storage
        .from('videos')
        .createSignedUrl(video.storage_path, 14400) // 4 hours — covers VPS queue wait + render time
      videoUrl = signedData?.signedUrl ?? null
      clipTitle = video.title
      clipDuration = video.duration_seconds
    }
  }

  if (!foundSource || !videoUrl) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable' },
      { status: 404 },
    )
  }

  return { videoUrl, clipTitle, clipDuration, foundSource, authorName, authorHandle, niche, platform }
}

// ── Idempotency check ──

export async function checkExistingJob(
  admin: SupabaseClient,
  clipId: string,
  userId: string,
  foundSource: string,
  force = false,
): Promise<NextResponse | null> {
  // When force=true, skip idempotency check (caller already cancelled stuck jobs)
  if (force) return null

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: existingJob } = await admin
    .from('render_jobs')
    .select('id, status, created_at')
    .eq('clip_id', clipId)
    .eq('user_id', userId)
    .in('status', ['pending', 'rendering', 'queued'] satisfies RenderStatus[])
    .gte('created_at', fifteenMinAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingJob) {
    return NextResponse.json({
      data: { clip_id: clipId, jobId: existingJob.id, rendered: false, source: foundSource, vpsReady: true },
      error: null,
      message: 'Render already in progress — tracking existing job',
    })
  }

  return null
}

// ── Plan enforcement (duration + quota) ──

export async function enforcePlanLimits(
  admin: SupabaseClient,
  userId: string,
  clipDuration: number | null,
): Promise<NextResponse | null> {
  const { data: profile } = await (admin
    .from('profiles')
    .select('plan, is_comp')
    .eq('id', userId)
    .single() as unknown as Promise<{ data: { plan: string | null; is_comp: boolean | null } | null }>)

  const callerPlan = resolveEffectivePlan(profile)

  // Duration check
  if (typeof clipDuration === 'number' && clipDuration > 0) {
    const durationCheck = checkClipDuration(callerPlan, clipDuration)
    if (!durationCheck.allowed) {
      return NextResponse.json(
        {
          data: { currentUsage: durationCheck.currentUsage, limit: durationCheck.limit, plan: durationCheck.plan },
          error: 'clip_too_long',
          message: durationCheck.reason ?? 'Clip trop long pour ton plan',
        },
        { status: 402 },
      )
    }
  }

  // Monthly quota
  const maxVideos = getPlanConfig(callerPlan).limits.maxVideosPerMonth
  const { data: quotaAllowed, error: quotaError } = await admin.rpc('increment_video_usage', {
    p_user_id: userId,
    p_max_videos: maxVideos,
  })

  if (quotaError) {
    console.error('[render] increment_video_usage failed:', quotaError)
    return NextResponse.json(
      { data: null, error: 'quota_check_failed', message: 'Failed to check quota. Try again.' },
      { status: 500 },
    )
  }

  if (quotaAllowed === false) {
    return NextResponse.json(
      {
        data: { plan: callerPlan },
        error: 'quota_exceeded',
        message: `Monthly limit reached for ${callerPlan} plan. Upgrade to continue.`,
      },
      { status: 402 },
    )
  }

  return null
}

// ── Resolve Twitch URL ──

export async function resolveTwitchUrl(videoUrl: string, foundSource: string): Promise<string> {
  if (foundSource === 'trending' && videoUrl.includes('twitch.tv')) {
    try {
      const resolved = await resolveTwitchClipFromUrlOrSlug(videoUrl)
      console.log(`[render] Resolved Twitch clip to signed CDN URL`)
      return resolved
    } catch (err) {
      console.warn(
        '[render] Twitch clip resolution failed, falling back to raw URL:',
        err instanceof Error ? err.message : err,
      )
    }
  }
  return videoUrl
}

// ── Create render job ──

export async function createRenderJob(
  admin: SupabaseClient,
  clipId: string,
  userId: string,
  foundSource: string,
): Promise<{ id: string } | NextResponse> {
  const { data: job, error: jobError } = await admin
    .from('render_jobs')
    .insert({
      clip_id: clipId,
      source: foundSource,
      user_id: userId,
      status: 'pending' satisfies RenderStatus,
      removed_from_bank_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { data: null, error: 'Job creation failed', message: 'Unable to start the render' },
      { status: 500 },
    )
  }

  return job as { id: string }
}

// ── Fire-and-forget to VPS ──

export function sendToVps(
  admin: SupabaseClient,
  jobId: string,
  userId: string,
  renderPayload: Record<string, unknown>,
  label = 'render',
) {
  const vpsUrl = process.env.VPS_RENDER_URL!
  const vpsKey = process.env.VPS_RENDER_API_KEY!

  const markFailed = async (errorMessage: string) => {
    console.error(`[${label}] VPS dispatch failure: ${errorMessage}`)
    await admin
      .from('render_jobs')
      .update({
        status: 'error' as RenderStatus,
        error_message: errorMessage.substring(0, 2000),
      })
      .eq('id', jobId)
    if (userId) {
      (admin.rpc as CallableFunction)('refund_video_usage', { p_user_id: userId, p_count: 1 })
        .catch((e: unknown) => console.error(`[${label}] refund failed for user ${userId}:`, e))
    }
    releaseJob(jobId).catch(() => {})
  }

  const run = async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      await withRetry(
        async () => {
          const r = await fetch(`${vpsUrl}/api/render`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': vpsKey,
            },
            body: JSON.stringify(renderPayload),
            signal: controller.signal,
          })

          if (!r.ok) {
            // Read the error body for diagnostics
            const body = await r.text().catch(() => '')
            const msg = `VPS rejected ${r.status}: ${body.substring(0, 500)}`

            if (r.status >= 500) {
              // 5xx: transient server error — throw to trigger retry
              throw new Error(msg)
            }

            // 4xx: client error — payload invalid, auth failed, duplicate, etc.
            // Do NOT retry (the payload won't become valid by retrying).
            // Mark the job as error immediately + refund + release slot.
            await markFailed(msg)
            return // exit retry loop without throwing (no retry)
          }
        },
        { retries: 1, delayMs: 2000, label: `VPS ${label}` },
      )
      clearTimeout(timeoutId)
    } catch (err) {
      clearTimeout(timeoutId)
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError')
      if (isAbort) {
        // 15s timeout elapsed — the VPS likely received the body (TCP ACK) and is
        // processing it. This is expected for renders that take 60-120s. Let VPS drive.
        console.log(`[${label}] VPS POST timed out (15s) — body likely delivered, letting VPS drive the job`)
        return
      }
      // 5xx retries exhausted or network error
      await markFailed(`VPS unreachable: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }
  run()
}
