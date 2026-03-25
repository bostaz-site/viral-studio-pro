import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadVideoToTikTok } from '@/lib/social/tiktok'
import { uploadReelToInstagram } from '@/lib/social/instagram'
import { uploadVideoToYouTube, refreshYouTubeToken } from '@/lib/social/youtube'
import { safeDecrypt, safeEncrypt } from '@/lib/crypto'

const platformCaptionSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
})

const bodySchema = z.object({
  clip_id: z.string().uuid(),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube'])).min(1),
  captions: z.record(z.enum(['tiktok', 'instagram', 'youtube']), platformCaptionSchema),
})

interface PublishResult {
  platform: string
  status: 'published' | 'error'
  platform_post_id?: string
  error?: string
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Non autorisé' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON', message: 'Corps invalide' },
      { status: 400 }
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.message, message: 'Paramètres invalides' },
      { status: 400 }
    )
  }

  const { clip_id, platforms, captions } = parsed.data
  const admin = createAdminClient()

  // Fetch clip
  const { data: clip, error: clipError } = await supabase
    .from('clips')
    .select('id, storage_path, title, transcript_segment')
    .eq('id', clip_id)
    .eq('user_id', user.id)
    .single()

  if (clipError || !clip || !clip.storage_path) {
    return NextResponse.json(
      { data: null, error: 'Clip not found', message: 'Clip introuvable ou non rendu' },
      { status: 404 }
    )
  }

  // Get public URL of the clip
  const { data: urlData } = supabase.storage.from('clips').getPublicUrl(clip.storage_path)
  const videoUrl = urlData.publicUrl

  // Fetch connected social accounts for this user
  const { data: accounts } = await admin
    .from('social_accounts')
    .select('id, platform, access_token, refresh_token, token_expires_at, platform_user_id')
    .eq('user_id', user.id)
    .in('platform', platforms)

  const accountMap = new Map(accounts?.map((a) => [a.platform, a]) ?? [])
  const results: PublishResult[] = []

  for (const platform of platforms) {
    const account = accountMap.get(platform)
    if (!account?.access_token) {
      results.push({ platform, status: 'error', error: 'Compte non connecté' })
      continue
    }

    // Decrypt token before use (tokens are encrypted in DB)
    const decryptedToken = safeDecrypt(account.access_token)
    if (!decryptedToken) {
      results.push({ platform, status: 'error', error: 'Token de connexion invalide — reconnectez votre compte' })
      continue
    }

    const copy = captions[platform]
    if (!copy) {
      results.push({ platform, status: 'error', error: 'Caption manquante' })
      continue
    }

    try {
      let platformPostId = ''
      let activeToken = decryptedToken

      // Refresh YouTube token if expired
      if (platform === 'youtube' && account.token_expires_at) {
        const expiresAt = new Date(account.token_expires_at)
        const now = new Date()
        // Refresh if token expires within 5 minutes
        if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
          const rawRefresh = safeDecrypt(account.refresh_token)
          if (rawRefresh) {
            const refreshed = await refreshYouTubeToken(
              rawRefresh,
              process.env.YOUTUBE_CLIENT_ID ?? '',
              process.env.YOUTUBE_CLIENT_SECRET ?? ''
            )
            activeToken = refreshed.access_token
            // Persist new token + expiry
            await admin.from('social_accounts').update({
              access_token: safeEncrypt(refreshed.access_token),
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }).eq('id', account.id)
          }
        }
      }

      switch (platform) {
        case 'tiktok': {
          const res = await uploadVideoToTikTok(
            activeToken,
            videoUrl,
            copy.caption,
            copy.hashtags
          )
          platformPostId = res.publish_id
          break
        }
        case 'instagram': {
          const res = await uploadReelToInstagram(
            activeToken,
            account.platform_user_id ?? '',
            videoUrl,
            copy.caption,
            copy.hashtags
          )
          platformPostId = res.id
          break
        }
        case 'youtube': {
          const res = await uploadVideoToYouTube(
            activeToken,
            videoUrl,
            clip.title ?? copy.caption.slice(0, 100),
            copy.caption,
            copy.hashtags
          )
          platformPostId = res.id
          break
        }
      }

      // Save publication record
      await admin.from('publications').insert({
        clip_id,
        social_account_id: account.id,
        platform,
        platform_post_id: platformPostId,
        caption: copy.caption,
        hashtags: copy.hashtags,
        published_at: new Date().toISOString(),
        status: 'published',
      })

      results.push({ platform, status: 'published', platform_post_id: platformPostId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de publication'
      await admin.from('publications').insert({
        clip_id,
        social_account_id: account.id,
        platform,
        caption: copy.caption,
        hashtags: copy.hashtags,
        status: 'error',
      })
      results.push({ platform, status: 'error', error: msg })
    }
  }

  const allOk = results.every((r) => r.status === 'published')
  return NextResponse.json({
    data: { results },
    error: allOk ? null : 'Certaines publications ont échoué',
    message: allOk ? 'Publié avec succès' : 'Publication partielle',
  })
}
