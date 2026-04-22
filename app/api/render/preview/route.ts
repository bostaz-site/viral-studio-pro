import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const VPS_URL = process.env.VPS_RENDER_URL || 'https://bostaz-site-production.up.railway.app'
const VPS_KEY = process.env.VPS_RENDER_API_KEY || ''

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const { videoUrl, clipTitle, clipDuration, wordTimestamps, settings } = body

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Missing videoUrl' },
        { status: 400 }
      )
    }

    // Forward to VPS preview endpoint
    const vpsResponse = await fetch(`${VPS_URL}/api/render/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': VPS_KEY,
      },
      body: JSON.stringify({
        videoUrl,
        source: 'trending',
        clipTitle,
        clipDuration,
        wordTimestamps,
        settings,
      }),
    })

    if (!vpsResponse.ok) {
      const errText = await vpsResponse.text().catch(() => 'Unknown error')
      console.error('[Preview API] VPS error:', errText)
      return NextResponse.json(
        { error: 'Preview render failed', details: errText },
        { status: 502 }
      )
    }

    const result = await vpsResponse.json()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Preview render failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        video: result.data.video, // base64 mp4
        mimeType: result.data.mimeType,
        duration: result.data.duration,
        resolution: result.data.resolution,
        renderTime: result.data.renderTime,
      },
    })
  } catch (err) {
    console.error('[Preview API] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
