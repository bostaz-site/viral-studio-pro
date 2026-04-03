import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare, safeDecrypt, safeEncrypt } from '@/lib/crypto'
import { uploadVideoToTikTok } from '@/lib/social/tiktok'
import { uploadReelToInstagram } from '@/lib/social/instagram'
import { uploadVideoToYouTube, refreshYouTubeToken } from '@/lib/social/youtube'

/**
 * POST /api/cron/publish-scheduled
 *
 * Publishes all scheduled publications whose scheduled_at <= now().
 * Should be called every 1-5 minutes by:
 *   - n8n cron workflow, OR
 *   - External cron (cron-job.org, GitHub Actions, etc.)
 *
 * Auth: x-api-key header = CRON_SECRET env var
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey || !cronSecret) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Clé API manquante' },
      { status: 401 }
    )
  }

  if (!timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Clé API invalide' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()

  try {
    // Fetch publications ready to publish
    const now = new Date().toISOString()
    const { data: publications, error: fetchError } = await admin
      .from('publications')
      .select('id, clip_id, social_account_id, platform, caption, hashtags')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(20) // Process in batches to avoid timeout

    if (fetchError) {
      return NextResponse.json(
        { data: null, error: fetchError.message, message: 'Erreur de récupération' },
        { status: 500 }
      )
    }

    if (!publications || publications.length === 0) {
      return NextResponse.json({
        data: { published: 0, errors: 0 },
        error: null,
        message: 'Aucune publication planifiée à traiter',
      })
    }

    let published = 0
    let errors = 0

    for (const pub of publications) {
      // Mark as publishing
      await admin.from('publications').update({ status: 'publishing' }).eq('id', pub.id)

      try {
        if (!pub.clip_id || !pub.social_account_id) {
          throw new Error('Publication incomplète : clip_id ou social_account_id manquant')
        }

        // Fetch clip storage path
        const { data: clip } = await admin
          .from('clips')
          .select('id, storage_path, title')
          .eq('id', pub.clip_id)
          .single()

        if (!clip?.storage_path) {
          throw new Error('Clip introuvable ou non rendu')
        }

        // Get public URL
        const { data: urlData } = admin.storage.from('clips').getPublicUrl(clip.storage_path)
        const videoUrl = urlData.publicUrl

        // Fetch social account with tokens
        const { data: account } = await admin
          .from('social_accounts')
          .select('id, platform, access_token, refresh_token, token_expires_at, platform_user_id')
          .eq('id', pub.social_account_id)
          .single()

        if (!account?.access_token) {
          throw new Error('Compte social non connecté ou token manquant')
        }

        let token = safeDecrypt(account.access_token)
        if (!token) {
          throw new Error('Token de connexion invalide')
        }

        // Refresh YouTube token if expired
        if (pub.platform === 'youtube' && account.token_expires_at) {
          const expiresAt = new Date(account.token_expires_at)
          if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
            const rawRefresh = safeDecrypt(account.refresh_token)
            if (rawRefresh) {
              const refreshed = await refreshYouTubeToken(
                rawRefresh,
                process.env.YOUTUBE_CLIENT_ID ?? '',
                process.env.YOUTUBE_CLIENT_SECRET ?? ''
              )
              token = refreshed.access_token
              await admin.from('social_accounts').update({
                access_token: safeEncrypt(refreshed.access_token),
                token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
              }).eq('id', account.id)
            }
          }
        }

        // Publish to platform
        let platformPostId = ''
        const caption = pub.caption ?? ''
        const hashtags = (pub.hashtags as string[]) ?? []

        switch (pub.platform) {
          case 'tiktok': {
            const res = await uploadVideoToTikTok(token, videoUrl, caption, hashtags)
            platformPostId = res.publish_id
            break
          }
          case 'instagram': {
            const res = await uploadReelToInstagram(
              token,
              account.platform_user_id ?? '',
              videoUrl,
              caption,
              hashtags
            )
            platformPostId = res.id
            break
          }
          case 'youtube': {
            const res = await uploadVideoToYouTube(
              token,
              videoUrl,
              clip.title ?? caption.slice(0, 100),
              caption,
              hashtags
            )
            platformPostId = res.id
            break
          }
          default:
            throw new Error(`Plateforme non supportée: ${pub.platform}`)
        }

        // Mark as published
        await admin.from('publications').update({
          status: 'published',
          platform_post_id: platformPostId,
          published_at: new Date().toISOString(),
        }).eq('id', pub.id)

        published++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Publication failed'
        await admin.from('publications').update({
          status: 'error',
        }).eq('id', pub.id)
        errors++
        console.error(`[cron/publish-scheduled] Publication ${pub.id} failed:`, msg)
      }
    }

    return NextResponse.json({
      data: { published, errors, total: publications.length },
      error: errors > 0 ? `${errors} publication(s) en erreur` : null,
      message: `${published} publié(s), ${errors} erreur(s) sur ${publications.length} planifiée(s)`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { data: null, error: message, message },
      { status: 500 }
    )
  }
}
