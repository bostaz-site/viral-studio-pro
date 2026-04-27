import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatform, PLATFORM_CONFIGS, type Platform } from '@/lib/distribution/platforms'
import { getValidToken } from '@/lib/distribution/token-manager'

const publishSchema = z.object({
  clip_id: z.string().uuid(),
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string()).max(30).optional(),
})

export const POST = withAuth(
  async (req: NextRequest, user) => {
    const url = new URL(req.url)
    const segments = url.pathname.split('/')
    const platformParam = segments[segments.indexOf('publish') + 1]

    if (!platformParam || !isPlatform(platformParam)) {
      return errorResponse(`Unsupported platform: ${platformParam}`, 400)
    }

    const config = PLATFORM_CONFIGS[platformParam]

    // Instagram stub
    if (platformParam === 'instagram') {
      return errorResponse(
        'Instagram publishing is coming soon. Connect your account now to be ready!',
        501
      )
    }

    // Parse body
    const body = await req.json()
    const parsed = publishSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 400)
    }

    const { clip_id, caption, hashtags } = parsed.data
    const admin = createAdminClient()

    // Verify clip exists and belongs to user
    // Check render_jobs first (rendered clips from trending_clips or uploaded videos)
    const { data: renderJob, error: renderError } = await admin
      .from('render_jobs')
      .select('id, clip_id, storage_path, clip_url, user_id')
      .eq('clip_id', clip_id)
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Fallback: check clips table
    let clipStoragePath: string | null = null
    let clipTitle: string | null = null

    if (renderJob?.storage_path) {
      clipStoragePath = renderJob.storage_path
      // Try to get title from trending_clips or videos
      const { data: trending } = await admin
        .from('trending_clips')
        .select('title')
        .eq('id', clip_id)
        .single()
      if (trending) {
        clipTitle = trending.title
      } else {
        const { data: video } = await admin
          .from('videos')
          .select('title')
          .eq('id', clip_id)
          .single()
        clipTitle = video?.title ?? null
      }
    } else {
      // Fallback to clips table
      const { data: clip } = await admin
        .from('clips')
        .select('id, storage_path, title, user_id')
        .eq('id', clip_id)
        .eq('user_id', user.id)
        .single()

      if (!clip) {
        return errorResponse('Clip not found. Make sure you have rendered this clip first.', 404)
      }
      clipStoragePath = clip.storage_path
      clipTitle = clip.title
    }

    if (!clipStoragePath) {
      return errorResponse('Clip has not been rendered yet. Render it first before publishing.', 400)
    }

    // Get valid token (auto-refreshes if expired)
    const tokenSet = await getValidToken(user.id, platformParam)
    if (!tokenSet) {
      return errorResponse(
        `No ${config.displayName} account connected. Connect it in Settings first.`,
        400
      )
    }

    // Get signed URL for the clip video
    const { data: signedUrlData, error: signedUrlError } = await admin.storage
      .from('clips')
      .createSignedUrl(clipStoragePath, 14400) // 4 hours

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return errorResponse('Failed to get video URL for publishing', 500)
    }

    const videoUrl = signedUrlData.signedUrl

    // Build full caption with hashtags
    const hashtagString = hashtags?.length
      ? '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : ''
    const fullCaption = caption + hashtagString

    // Create publication record (status: publishing)
    const { data: publication, error: pubError } = await admin
      .from('publications')
      .insert({
        clip_id,
        social_account_id: null, // We'll update after finding the account
        platform: platformParam,
        caption,
        hashtags: hashtags ?? [],
        status: 'publishing',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (pubError || !publication) {
      return errorResponse(`Failed to create publication record: ${pubError?.message}`, 500)
    }

    // Get social account ID for the publication record
    const { data: socialAccount } = await admin
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', platformParam)
      .single()

    if (socialAccount) {
      await admin
        .from('publications')
        .update({ social_account_id: socialAccount.id })
        .eq('id', publication.id)
    }

    // Publish to platform
    try {
      const result = await publishToPlatform(
        platformParam,
        tokenSet.accessToken,
        videoUrl,
        fullCaption,
        clipTitle ?? 'Viral Animal Clip'
      )

      // Update publication record with success
      await admin
        .from('publications')
        .update({
          status: 'published',
          platform_post_id: result.postId ?? null,
          tracking_url: result.trackingUrl ?? null,
          published_at: new Date().toISOString(),
        })
        .eq('id', publication.id)

      return jsonResponse({
        publicationId: publication.id,
        platform: platformParam,
        postId: result.postId,
        trackingUrl: result.trackingUrl,
        status: 'published',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Publishing failed'

      // Update publication record with error
      await admin
        .from('publications')
        .update({
          status: 'error',
        })
        .eq('id', publication.id)

      return errorResponse(errMsg, 500)
    }
  }
)

// ── Platform-specific publish logic ────────────────────────────────────────────

interface PublishResult {
  postId: string | null
  trackingUrl: string | null
}

async function publishToPlatform(
  platform: Platform,
  accessToken: string,
  videoUrl: string,
  caption: string,
  title: string
): Promise<PublishResult> {
  switch (platform) {
    case 'tiktok':
      return publishToTikTok(accessToken, videoUrl, caption)
    case 'youtube':
      return publishToYouTube(accessToken, videoUrl, caption, title)
    case 'instagram':
      throw new Error('Instagram publishing is not yet available')
    default:
      throw new Error(`Publishing not supported for platform: ${platform}`)
  }
}

// ── TikTok Direct Post ─────────────────────────────────────────────────────────

async function publishToTikTok(
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<PublishResult> {
  // Step 1: Initialize video publish with pull-from-URL
  const initRes = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: caption.slice(0, 150), // TikTok title limit
          privacy_level: 'SELF_ONLY', // Start as private — user can change on TikTok
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    }
  )

  const initData = await initRes.json() as {
    data?: { publish_id?: string }
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (!initRes.ok || initData.error?.code) {
    throw new Error(
      `TikTok publish failed: ${initData.error?.message ?? 'Unknown error'} ` +
      `(code: ${initData.error?.code ?? 'none'})`
    )
  }

  const publishId = initData.data?.publish_id ?? null

  return {
    postId: publishId,
    trackingUrl: null, // TikTok doesn't return a direct URL immediately
  }
}

// ── YouTube Resumable Upload ───────────────────────────────────────────────────

async function publishToYouTube(
  accessToken: string,
  videoUrl: string,
  caption: string,
  title: string
): Promise<PublishResult> {
  // Step 1: Download the video from signed URL
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    throw new Error('Failed to download clip for YouTube upload')
  }

  const videoBuffer = await videoRes.arrayBuffer()
  const videoBytes = new Uint8Array(videoBuffer)
  const contentLength = videoBytes.length

  // Step 2: Start resumable upload
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: caption,
      categoryId: '24', // Entertainment
      tags: ['shorts', 'viral', 'clips'],
    },
    status: {
      privacyStatus: 'private', // Start as private — user can change on YouTube
      selfDeclaredMadeForKids: false,
    },
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': contentLength.toString(),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!initRes.ok) {
    const errorBody = await initRes.text()
    throw new Error(`YouTube upload init failed: ${errorBody}`)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('YouTube did not return an upload URL')
  }

  // Step 3: Upload the video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': contentLength.toString(),
    },
    body: videoBytes,
  })

  const uploadData = await uploadRes.json() as {
    id?: string
    error?: { message?: string; errors?: Array<{ message?: string }> }
  }

  if (!uploadRes.ok || !uploadData.id) {
    const errMsg =
      uploadData.error?.errors?.[0]?.message ??
      uploadData.error?.message ??
      'Upload failed'
    throw new Error(`YouTube upload failed: ${errMsg}`)
  }

  return {
    postId: uploadData.id,
    trackingUrl: `https://youtube.com/watch?v=${uploadData.id}`,
  }
}
