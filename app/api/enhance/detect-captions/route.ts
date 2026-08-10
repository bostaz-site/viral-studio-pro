import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { z } from 'zod'

const VPS_URL = process.env.VPS_RENDER_URL || ''
const VPS_API_KEY = process.env.VPS_RENDER_API_KEY || ''

const schema = z.object({
  videoUrl: z.string().min(1),
  duration: z.number().positive().optional(),
})

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  if (!VPS_URL) {
    // No VPS configured — return false silently
    return jsonResponse({ burned_captions: false, position: null, confidence: 0 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const res = await fetch(`${VPS_URL}/api/render/detect-captions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': VPS_API_KEY,
      },
      body: JSON.stringify(parsed.data),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const json = await res.json() as {
      data?: { burned_captions: boolean; position: string | null; confidence: number }
      error?: string
    }

    return jsonResponse(json.data ?? { burned_captions: false, position: null, confidence: 0 })
  } catch {
    // Silent failure — return false
    return jsonResponse({ burned_captions: false, position: null, confidence: 0 })
  }
})
