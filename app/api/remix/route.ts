import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const bodySchema = z.object({
  trending_clip_id: z.string().uuid(),
})

/**
 * POST /api/remix — Initiate a remix job.
 *
 * This is a FAST endpoint (~1-2s) that:
 * 1. Validates auth + rate limit + quota
 * 2. Creates a video record with status 'processing'
 * 3. Returns immediately with the video ID
 *
 * The heavy work (download, transcribe, analyze) happens on the VPS
 * via n8n webhook trigger or direct VPS call from the frontend.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps invalide' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Paramètres invalides' }, { status: 400 })
  }

  const { trending_clip_id } = parsed.data

  // ── Rate limiting ───────────────────────────────────────────────────────
  const rl = rateLimit(user.id, RATE_LIMITS.ai.limit, RATE_LIMITS.ai.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
      { status: 429 }
    )
  }

  const admin = createAdminClient()

  // ── Get plan config ────────────────────────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, monthly_videos_used')
    .eq('id', user.id)
    .single()

  const planConfig = getPlanConfig(profile?.plan)
  const maxVideos = planConfig.limits.maxVideosPerMonth

  // Fetch trending clip
  const { data: trendingClip, error: trendingError } = await admin
    .from('trending_clips')
    .select('*')
    .eq('id', trending_clip_id)
    .single()

  if (trendingError || !trendingClip) {
    return NextResponse.json({ data: null, error: 'Not found', message: 'Clip trending introuvable' }, { status: 404 })
  }

  // ── Atomic quota check + increment ────────────────────────────────────
  const { data: quotaAllowed, error: rpcError } = await admin.rpc('increment_video_usage', {
    p_user_id: user.id,
    p_max_videos: maxVideos,
  })

  if (rpcError || !quotaAllowed) {
    return NextResponse.json(
      { data: null, error: 'Plan limit reached', message: `Limite atteinte : ${maxVideos === -1 ? '∞' : maxVideos} vidéos/mois sur le plan ${planConfig.name}.` },
      { status: 403 }
    )
  }

  try {
    // ── Create video record (status: processing) ──────────────────────────
    const { data: video, error: videoError } = await admin
      .from('videos')
      .insert({
        user_id: user.id,
        title: trendingClip.title ?? 'Remix en cours...',
        source_url: trendingClip.external_url,
        source_platform: trendingClip.platform,
        storage_path: `${user.id}/remix_pending_${Date.now()}.mp4`, // Placeholder, updated by VPS
        status: 'processing' as const,
      })
      .select('id')
      .single()

    if (videoError || !video) {
      // Rollback quota
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
      throw new Error(`Video insert failed: ${videoError?.message}`)
    }

    // ── Trigger VPS processing (fire-and-forget) ────────────────────────────
    const vpsUrl = process.env.VPS_RENDER_URL ?? 'http://37.27.190.229:3100'
    const n8nUrl = process.env.N8N_BASE_URL

    // Try n8n first (preferred), fallback to direct VPS call
    const webhookPayload = {
      video_id: video.id,
      user_id: user.id,
      trending_clip_id: trendingClip.id,
      external_url: trendingClip.external_url,
      platform: trendingClip.platform,
      author_name: trendingClip.author_name ?? trendingClip.author_handle ?? 'Unknown',
    }

    // Fire-and-forget: don't await the VPS response
    const triggerUrl = n8nUrl
      ? `${n8nUrl}/webhook/remix-process`
      : `${vpsUrl}/api/remix/process`

    fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_API_KEY ?? process.env.VPS_API_KEY ?? ''}`,
      },
      body: JSON.stringify(webhookPayload),
    }).catch(() => {
      // Log failure but don't block the response
      // The video status will stay 'processing' and can be retried
    })

    return NextResponse.json({
      data: {
        video_id: video.id,
        status: 'processing',
        message: 'Le remix est en cours de traitement. Suivez la progression dans le dashboard.',
        trending_clip: {
          title: trendingClip.title,
          platform: trendingClip.platform,
          author: trendingClip.author_name,
        },
      },
      error: null,
      message: 'Remix initié — traitement en arrière-plan',
    })
  } catch (err) {
    // Rollback quota on failure
    try {
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
    } catch {
      // Ignore rollback errors
    }
    const message = err instanceof Error ? err.message : 'Erreur lors du remix'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}
