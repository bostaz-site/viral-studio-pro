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
 * POST /api/remix — Initiate a remix from a trending/stream clip.
 *
 * This is a FAST endpoint (~1-2s) that:
 * 1. Validates auth + rate limit + quota
 * 2. Creates a video record with status 'processing'
 * 3. Fires off VPS download/import (same pipeline as URL import)
 * 4. Returns immediately with the video ID
 *
 * The VPS downloads the clip, uploads to Supabase Storage, and updates the DB.
 * The user is then redirected to /create where they can transcribe + analyze.
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

  // ── VPS configuration ───────────────────────────────────────────────────
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
    return NextResponse.json(
      { data: null, error: 'VPS not configured', message: 'Le serveur de traitement n\'est pas configuré' },
      { status: 503 }
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
    const clipTitle = trendingClip.title ?? 'Remix en cours...'
    const { data: video, error: videoError } = await admin
      .from('videos')
      .insert({
        user_id: user.id,
        title: clipTitle,
        source_url: trendingClip.external_url,
        source_platform: trendingClip.platform,
        storage_path: 'pending',
        status: 'processing' as const,
      })
      .select('id')
      .single()

    if (videoError || !video) {
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
      throw new Error(`Video insert failed: ${videoError?.message}`)
    }

    // ── Fire-and-forget: VPS download/import (same pipeline as URL import) ──
    fetch(`${vpsUrl}/api/download/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vpsKey,
      },
      body: JSON.stringify({
        url: trendingClip.external_url,
        userId: user.id,
        videoId: video.id,
      }),
    }).catch((err) => {
      console.error('[remix] VPS fire-and-forget error:', err)
    })

    return NextResponse.json({
      data: {
        video_id: video.id,
        status: 'processing',
        message: 'Le clip est en cours de téléchargement. Vous allez être redirigé.',
        trending_clip: {
          title: trendingClip.title,
          platform: trendingClip.platform,
          author: trendingClip.author_name,
        },
      },
      error: null,
      message: 'Remix initié — téléchargement en arrière-plan',
    })
  } catch (err) {
    try {
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
    } catch {
      // Ignore rollback errors
    }
    const message = err instanceof Error ? err.message : 'Erreur lors du remix'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}
