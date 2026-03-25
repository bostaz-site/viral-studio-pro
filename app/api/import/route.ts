import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanConfig } from '@/lib/plans'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { downloadVideo, readVideoFile, cleanupTempFile } from '@/lib/ytdlp'

const bodySchema = z.object({
  url: z.string().url(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

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

  // ── Plan enforcement: get plan config ───────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, monthly_videos_used')
    .eq('id', user.id)
    .single()

  const planConfig = getPlanConfig(profile?.plan)
  const maxVideos = planConfig.limits.maxVideosPerMonth

  // ── Atomic quota check + increment ────────────────────────────────────
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

  let localPath: string | null = null

  try {
    // Download via yt-dlp
    const result = await downloadVideo(url)
    localPath = result.localPath

    // Read file buffer (async, non-blocking)
    const fileBuffer = await readVideoFile(localPath)

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${Date.now()}_${result.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.mp4`
    const { error: uploadError } = await admin.storage
      .from('videos')
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // Insert video record
    const { data: video, error: dbError } = await admin
      .from('videos')
      .insert({
        user_id: user.id,
        title: result.title,
        source_url: url,
        source_platform: result.platform,
        storage_path: storagePath,
        duration_seconds: Math.round(result.duration),
        mime_type: 'video/mp4',
        status: 'uploaded' as const,
      })
      .select('id')
      .single()

    if (dbError || !video) throw new Error(`DB insert failed: ${dbError?.message ?? 'unknown'}`)

    return NextResponse.json({
      data: {
        video_id: video.id,
        title: result.title,
        platform: result.platform,
        usage: {
          used: (profile?.monthly_videos_used ?? 0) + 1,
          limit: maxVideos,
          plan: planConfig.id,
        },
      },
      error: null,
      message: 'Vidéo importée avec succès',
    })
  } catch (err) {
    // Rollback quota on failure
    await admin.rpc('decrement_video_usage', { p_user_id: user.id })
    const message = err instanceof Error ? err.message : 'Erreur lors de l\'import'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  } finally {
    if (localPath) cleanupTempFile(localPath)
  }
}
