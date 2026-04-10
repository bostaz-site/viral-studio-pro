import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'

const inputSchema = z.object({
  transcript: z.string().optional().default(''),
  wordTimestamps: z.array(z.object({
    word: z.string(),
    start: z.number(),
    end: z.number(),
  })).optional().default([]),
  audioPeaks: z.array(z.object({
    time: z.number(),
    amplitude: z.number(),
  })).optional().default([]),
  duration: z.number().optional().default(30),
  title: z.string().optional().default(''),
  streamerName: z.string().optional().default(''),
  niche: z.string().optional().default('irl'),
  hookLength: z.number().min(1).max(3).optional().default(1.5),
  maxContext: z.number().optional().default(8),
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const parsed = inputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message, message: 'Invalid input' },
        { status: 400 }
      )
    }

    const VPS_URL = process.env.VPS_RENDER_URL
    const VPS_KEY = process.env.VPS_RENDER_API_KEY

    if (!VPS_URL) {
      return NextResponse.json(
        { data: null, error: 'VPS not configured', message: 'VPS_RENDER_URL not set' },
        { status: 500 }
      )
    }

    const vpsRes = await fetch(`${VPS_URL}/api/render/hook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(VPS_KEY ? { 'x-api-key': VPS_KEY } : {}),
      },
      body: JSON.stringify(parsed.data),
    })

    const vpsJson = await vpsRes.json()

    if (!vpsRes.ok) {
      return NextResponse.json(
        { data: null, error: vpsJson.error || 'VPS error', message: vpsJson.message || 'Hook generation failed' },
        { status: vpsRes.status }
      )
    }

    return NextResponse.json(vpsJson)
  } catch (err) {
    console.error('[API/render/hook] Error:', err)
    return NextResponse.json(
      { data: null, error: 'Internal error', message: 'Failed to generate hooks' },
      { status: 500 }
    )
  }
})
