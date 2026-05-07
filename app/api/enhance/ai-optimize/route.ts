import { z } from 'zod'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { detectMood } from '@/lib/ai/mood-detector'
import { MOOD_PRESETS } from '@/lib/ai/mood-presets'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  transcript: z.string().max(5000),
  title: z.string().max(500).optional(),
  streamer: z.string().max(200).optional(),
  niche: z.string().max(100).optional(),
})

export const POST = withAuth(async (req, user) => {
  // Plan-aware rate limit: 30/day free, 300/day pro/studio
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = profile?.plan ?? 'free'
  const limit = plan === 'free'
    ? RATE_LIMITS.aiOptimize
    : RATE_LIMITS.aiOptimizePro
  const rl = await rateLimit(`ai-optimize:${user.id}`, limit.limit, limit.windowMs)
  if (!rl.allowed) {
    return errorResponse(
      plan === 'free'
        ? 'Daily limit reached (30/day). Upgrade to Pro for 300/day.'
        : 'Daily limit reached. Please try again tomorrow.',
      429,
    )
  }

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
      important_words: result.important_words ?? [],
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
