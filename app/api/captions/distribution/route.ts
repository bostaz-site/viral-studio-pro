import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { generateDistributionCaptions, type DistributionCaptionResult, type CaptionPlatform } from '@/lib/ai/caption-engine'
import { z } from 'zod'

/**
 * POST /api/captions/distribution
 *
 * Generates AI captions for distribution platforms via Claude Haiku.
 * Rate limited: 10/day free, 100/day pro/studio.
 * Results cached in-memory (24h TTL) and persisted in distribution_captions table.
 */

// ── In-memory cache (per serverless instance) ──

const cache = new Map<string, { result: DistributionCaptionResult; ts: number }>()
const CACHE_TTL = 24 * 3600 * 1000 // 24h

function getCacheKey(clipId: string, platforms: string[]): string {
  return `${clipId}:${[...platforms].sort().join(',')}`
}

// ── Validation ──

const bodySchema = z.object({
  clipId: z.string().min(1).max(100),
  transcript: z.string().max(5000).default(''),
  mood: z.enum(['rage', 'funny', 'drama', 'wholesome', 'hype', 'story']),
  niche: z.string().max(100).optional(),
  streamerName: z.string().max(200).optional(),
  sourceStreamer: z.string().max(200).optional(),
  platforms: z.array(z.enum(['tiktok', 'youtube', 'instagram'])).min(1).max(3),
})

// ── Handler ──

export const POST = withAuth(async (req, user) => {
  // Parse + validate body
  const rawBody = await req.json().catch(() => null)
  if (!rawBody) return errorResponse('Invalid JSON body', 400)

  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.issues[0]?.message ?? 'invalid input'}`, 400)
  }

  const { clipId, transcript, mood, niche, streamerName, sourceStreamer, platforms } = parsed.data

  // Rate limit per user (daily window)
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan ?? 'free'
  const dailyLimit = plan === 'free' ? 10 : 100
  const rl = await rateLimit(`captions:${user.id}`, dailyLimit, 86400_000)
  if (!rl.allowed) {
    return errorResponse(
      `Daily caption limit reached (${dailyLimit}/day on ${plan} plan). ${plan === 'free' ? 'Upgrade to Pro for 100/day.' : 'Try again tomorrow.'}`,
      429
    )
  }

  // Check in-memory cache
  const cacheKey = getCacheKey(clipId, platforms)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return jsonResponse(cached.result)
  }

  // Generate captions
  const result = await generateDistributionCaptions({
    clipId,
    transcript,
    mood,
    niche,
    streamerName,
    sourceStreamer,
    platforms: platforms as CaptionPlatform[],
  })

  // Extract tokens if available
  const tokensUsed = (result as DistributionCaptionResult & { _tokensUsed?: number })._tokensUsed ?? null
  // Clean internal field before returning
  const cleanResult = { ...result }
  delete (cleanResult as Record<string, unknown>)['_tokensUsed']

  // Cache result
  cache.set(cacheKey, { result: cleanResult, ts: Date.now() })

  // Persist to DB (best-effort)
  const { error: persistErr } = await admin
    .from('distribution_captions')
    .insert({
      clip_id: clipId,
      user_id: user.id,
      platforms,
      variants: JSON.parse(JSON.stringify(cleanResult)),
      tokens_used: tokensUsed,
    })
  if (persistErr) console.error('[captions/distribution] persist error:', persistErr)

  return jsonResponse(cleanResult)
})
