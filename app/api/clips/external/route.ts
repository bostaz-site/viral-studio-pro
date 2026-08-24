import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { generateExternalUrlHmac } from '@/lib/distribution/external-url'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clips/external?path=<storage_path>&exp=<unix_ts>&sig=<hmac>
 *
 * Streams a rendered clip from Supabase Storage VIA viralanimal.com domain.
 * Required because TikTok's PULL_FROM_URL only accepts URLs from verified
 * domains, and we own viralanimal.com (not supabase.co).
 *
 * Auth: HMAC-signed query params (path + exp). Tokens expire in 4 hours.
 * The publish route generates these signed URLs and passes them to TikTok.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const path = url.searchParams.get('path')
  const expStr = url.searchParams.get('exp')
  const sig = url.searchParams.get('sig')

  if (!path || !expStr || !sig) {
    return NextResponse.json(
      { error: 'Missing path, exp, or sig parameters' },
      { status: 400 }
    )
  }

  const exp = parseInt(expStr, 10)
  if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'URL expired' }, { status: 410 })
  }

  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    logger.error('[clips/external] ENCRYPTION_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const expected = generateExternalUrlHmac(path, exp, secret)
  // Constant-time comparison to prevent timing attacks
  if (
    expected.length !== sig.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // Generate Supabase signed URL and stream the video
  const admin = createAdminClient()
  const { data: signedUrlData, error: signedUrlError } = await admin.storage
    .from('clips')
    .createSignedUrl(path, 3600)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    logger.error('[clips/external] Failed to get signed URL', signedUrlError)
    return NextResponse.json({ error: 'Failed to access clip' }, { status: 404 })
  }

  // Fetch the video from Supabase and stream it back
  const videoResponse = await fetch(signedUrlData.signedUrl)
  if (!videoResponse.ok || !videoResponse.body) {
    return NextResponse.json(
      { error: `Upstream fetch failed: ${videoResponse.status}` },
      { status: 502 }
    )
  }

  // Stream the video bytes
  return new NextResponse(videoResponse.body, {
    status: 200,
    headers: {
      'Content-Type': videoResponse.headers.get('Content-Type') ?? 'video/mp4',
      'Content-Length': videoResponse.headers.get('Content-Length') ?? '',
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': videoResponse.headers.get('Accept-Ranges') ?? 'bytes',
    },
  })
}
