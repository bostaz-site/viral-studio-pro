/**
 * Caption Diversifier — P4 · Copywriter SEO (2026-09).
 *
 * When the SAME clip is published more than once (other platform / account /
 * time) with an IDENTICAL caption, TikTok treats the posts as duplicates and
 * the second one gets throttled. This module detects the duplicate at publish
 * time and asks Claude Haiku for a variant:
 *   - different phrasing + different open question
 *   - SAME niche keyword (SEO alignment with on-screen hook)
 *   - hashtags reordered / alternated (still niche-only)
 *
 * Cheap (one Haiku call, ~300 tokens) and FAIL-OPEN: any error → original caption.
 * Deterministic per publication: `seed` (publication/scheduled id) is passed to
 * the model and used to pick the hashtag rotation.
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeDescription, filterHashtags, BANNED_ENGAGEMENT_BAIT } from './caption-filters'
import { logAiCall } from '@/lib/ai/call-logger'
import { logger } from '@/lib/logger'

export interface DiversifyParams {
  admin: ReturnType<typeof createAdminClient>
  clipId: string
  caption: string
  hashtags: string[]
  /** Deterministic seed — publication id, scheduled_publication id, or `${clipId}:${platform}:${Date}` */
  seed: string
  nicheKeyword?: string | null
  streamerHandle?: string | null
  platform?: string
  /** Exclude a specific publications/scheduled_publications row id (the one being created) */
  excludeId?: string | null
}

export interface DiversifyResult {
  caption: string
  hashtags: string[]
  diversified: boolean
  reason?: string
}

const MODEL = 'claude-haiku-4-5-20251001'

function seededIndex(seed: string, mod: number): number {
  let h = 0x9e3779b9
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x5bd1e995)
    h ^= h >>> 15
  }
  return mod > 0 ? (h >>> 0) % mod : 0
}

/** Rotate hashtags deterministically (same set, different order/first tag). */
export function rotateHashtags(hashtags: string[], seed: string): string[] {
  const clean = filterHashtags(hashtags, 3)
  if (clean.length < 2) return clean
  const k = 1 + seededIndex(seed, clean.length - 1)
  return [...clean.slice(k), ...clean.slice(0, k)]
}

/**
 * Check whether an identical caption was already used for this clip.
 * Looks at `publications` (manual publish) and `scheduled_publications`
 * (autofarm, status published). Empty caption never counts as duplicate.
 */
export async function hasDuplicateCaption(
  admin: DiversifyParams['admin'],
  clipId: string,
  caption: string,
  excludeId?: string | null,
): Promise<boolean> {
  const trimmed = caption.trim()
  if (!trimmed) return false
  try {
    let q = admin
      .from('publications')
      .select('id')
      .eq('clip_id', clipId)
      .eq('caption', caption)
      .limit(1)
    if (excludeId) q = q.neq('id', excludeId)
    const { data: pubs } = await q
    if (pubs && pubs.length > 0) return true

    let q2 = admin
      .from('scheduled_publications')
      .select('id')
      .eq('clip_id', clipId)
      .eq('caption', caption)
      .eq('status', 'published')
      .limit(1)
    if (excludeId) q2 = q2.neq('id', excludeId)
    const { data: sched } = await q2
    return !!(sched && sched.length > 0)
  } catch {
    return false
  }
}

/**
 * If the caption was already used for this clip, request a Haiku variant.
 * Fail-open: returns the original caption on any error.
 */
export async function diversifyCaptionIfDuplicate(params: DiversifyParams): Promise<DiversifyResult> {
  const { admin, clipId, caption, hashtags, seed, nicheKeyword, streamerHandle, platform, excludeId } = params
  const original: DiversifyResult = { caption, hashtags, diversified: false }

  if (!caption.trim()) return { ...original, reason: 'empty_caption' }

  const duplicate = await hasDuplicateCaption(admin, clipId, caption, excludeId)
  if (!duplicate) return { ...original, reason: 'no_duplicate' }

  const rotatedTags = rotateHashtags(hashtags, seed)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Still rotate hashtags — cheap and deterministic
    return { caption, hashtags: rotatedTags, diversified: rotatedTags.join() !== hashtags.join(), reason: 'no_api_key' }
  }

  const startMs = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Rewrite this TikTok caption as a fresh VARIANT for a repost of the same clip${platform ? ` on ${platform}` : ''}.
Variant seed: ${seed}

ORIGINAL: "${caption.slice(0, 400)}"
${nicheKeyword ? `NICHE KEYWORD (must stay verbatim): ${nicheKeyword}` : ''}
${streamerHandle ? `CREDIT (must stay): @${streamerHandle.replace(/^@/, '')}` : ''}

RULES:
- Different phrasing AND a different genuine open question (exactly one "?").
- Keep the same meaning, same niche keyword, same @credit.
- Under 100 characters before hashtags (max 150).
- No generic hashtags (#fyp #viral #foryou #trending), no vulgarity.
- Never ask for likes/tags/comments (${BANNED_ENGAGEMENT_BAIT.slice(0, 5).map(p => `"${p}"`).join(', ')}).
- Hashtags: reuse these niche tags in a different order, you may swap ONE for a closely related niche tag: ${rotatedTags.join(' ') || '(none)'}

Return ONLY JSON: {"caption": "...", "hashtags": ["#a", "#b"]}`,
        }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const latencyMs = Date.now() - startMs

    if (!res.ok) {
      logAiCall({ model: MODEL, feature: 'caption_diversify', latencyMs, success: false, error: `HTTP ${res.status}` })
      return { caption, hashtags: rotatedTags, diversified: true, reason: `api_${res.status}` }
    }

    const data = await res.json()
    logAiCall({
      model: MODEL, feature: 'caption_diversify', latencyMs, success: true,
      tokensInput: data.usage?.input_tokens, tokensOutput: data.usage?.output_tokens,
      metadata: { clipId, platform: platform ?? null },
    })

    const text: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { caption, hashtags: rotatedTags, diversified: true, reason: 'parse_error' }

    const parsed = JSON.parse(jsonMatch[0]) as { caption?: unknown; hashtags?: unknown }
    const variant = typeof parsed.caption === 'string' ? parsed.caption : ''
    if (!variant.trim() || variant.trim() === caption.trim()) {
      return { caption, hashtags: rotatedTags, diversified: true, reason: 'same_output' }
    }

    const s = sanitizeDescription({
      caption: variant,
      hashtags: Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0 ? parsed.hashtags : rotatedTags,
      nicheKeyword,
      streamerHandle,
      maxHashtags: 3,
    })

    logger.info(`[caption-diversifier] clip=${clipId} seed=${seed} variant generated (${s.caption.length} chars)`)
    return { caption: s.caption, hashtags: s.hashtags.length > 0 ? s.hashtags : rotatedTags, diversified: true, reason: 'variant' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logAiCall({ model: MODEL, feature: 'caption_diversify', latencyMs: Date.now() - startMs, success: false, error: msg })
    logger.warn(`[caption-diversifier] fail-open (${msg}) — using original caption`)
    return { caption, hashtags: rotatedTags, diversified: true, reason: 'error' }
  }
}
