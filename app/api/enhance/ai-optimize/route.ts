import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { detectMood } from '@/lib/ai/mood-detector'
import { MOOD_PRESETS } from '@/lib/ai/mood-presets'

const schema = z.object({
  transcript: z.string().max(5000),
  title: z.string().max(500).optional(),
  streamer: z.string().max(200).optional(),
  niche: z.string().max(100).optional(),
})

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { transcript, title, streamer, niche } = parsed.data

  try {
    const result = await detectMood(transcript, title, streamer, niche)
    const preset = MOOD_PRESETS[result.mood]

    return jsonResponse({
      mood: result.mood,
      confidence: result.confidence,
      explanation: result.explanation,
      secondary_mood: result.secondary_mood ?? null,
      preset,
    })
  } catch {
    // Fallback to hype on any error
    const fallbackPreset = MOOD_PRESETS.hype

    return jsonResponse({
      mood: 'hype' as const,
      confidence: 30,
      explanation: 'Default preset applied',
      secondary_mood: null,
      preset: fallbackPreset,
    })
  }
})
