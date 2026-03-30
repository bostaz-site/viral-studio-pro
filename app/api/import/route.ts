import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { withAuth } from '@/lib/api/withAuth'

const bodySchema = z.object({
  url: z.string().url(),
})

export const POST = withAuth(async (req, user) => {

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rl = rateLimit(user.id, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { data: null, error: 'Rate limited', message: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)}s` },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON', message: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'URL invalide' }, { status: 400 })
  }

  const { url } = parsed.data
  const admin = createAdminClient()

  // ── VPS configuration ──────────────────────────────────────────────────────
  const vpsUrl = process.env.VPS_RENDER_URL
  const vpsKey = process.env.VPS_RENDER_API_KEY

  if (!vpsUrl || !vpsKey) {
    return NextResponse.json(
      { data: null, error: 'VPS not configured', message: 'Le serveur de téléchargement n\'est pas configuré' },
      { status: 503 }
    )
  }

  // ── Plan enforcement ───────────────────────────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, monthly_videos_used')
    .eq('id', user.id)
    .single()

  const planConfig = getPlanConfig(profile?.plan)
  const maxVideos = planConfig.limits.maxVideosPerMonth

  // ── Atomic quota check + increment ────────────────────────────────────────
  const { data: quotaAllowed, error: rpcError } = await admin.rpc('increment_video_usage', {
    p_user_id: user.id,
    p_max_videos: maxVideos,
  })

  if (rpcError || !quotaAllowed) {
    return NextResponse.json(
      { data: null, error: 'Plan limit reached', message: `Limite atteinte : ${maxVideos === -1 ? '∞' : maxVideos} vidéos/mois sur le plan ${planConfig.name}. Passez au plan supérieur.` },
      { status: 403 }
    )
  }

  try {
    // ── Create video record FIRST with status 'processing' ──────────────────
    const { data: video, error: dbError } = await admin
      .from('videos')
      .insert({
        user_id: user.id,
        title: 'Import en cours...',
        source_url: url,
        source_platform: 'unknown',
        storage_path: 'pending',
        duration_seconds: 0,
        mime_type: 'video/mp4',
        status: 'processing' as const,
      })
      .select('id')
      .single()

    if (dbError || !video) {
      await admin.rpc('decrement_video_usage', { p_user_id: user.id })
      throw new Error(`DB insert failed: ${dbError?.message ?? 'unknown'}`)
    }

    // ── Fire-and-forget: tell VPS to download + upload ───────────────────────
    // VPS will update the video record in DB when done (has service role key)
    fetch(`${vpsUrl}/api/download/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vpsKey,
      },
      body: JSON.stringify({ url, userId: user.id, videoId: video.id }),
    }).catch((err) => {
      console.error('[import] VPS fire-and-forget error:', err)
    })

    // ── Return immediately — don't wait for VPS ─────────────────────────────
    return NextResponse.json({
      data: {
        video_id: video.id,
        title: 'Import en cours...',
        platform: 'unknown',
        usage: {
          used: (profile?.monthly_videos_used ?? 0) + 1,
          limit: maxVideos,
          plan: planConfig.id,
        },
      },
      error: null,
      message: 'Import lancé — la vidéo sera prête dans quelques instants',
    })
  } catch (err) {
    await admin.rpc('decrement_video_usage', { p_user_id: user.id })
    console.error('[import] Error:', err)
    return NextResponse.json(
      { data: null, error: 'Internal server error', message: 'Erreur lors de l\'import de la vidéo' },
      { status: 500 }
    )
  }
})
