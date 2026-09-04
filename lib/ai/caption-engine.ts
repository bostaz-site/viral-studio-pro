/**
 * AI Caption Engine for Distribution.
 * Generates platform-specific captions + hashtags via Claude Haiku.
 * Graceful fallback to templates if API unavailable.
 *
 * P4 · Copywriter SEO (2026-09) — every description follows:
 *   [sentence containing the niche keyword] + [one genuine open question]
 *   + [credit @streamer] + [1-3 niche hashtags]
 * Hard bans (prompt + post-filter): generic hashtags (#fyp/#viral/...),
 * engagement bait ("like if", "tag a friend"...), vulgarity.
 * See lib/distribution/caption-filters.ts.
 */

import type { ClipMood } from './mood-presets'
import {
  BANNED_ENGAGEMENT_BAIT,
  BANNED_HYPE_PHRASES,
  sanitizeDescription,
  stripBannedPhrases,
  stripBannedWords,
  filterHashtags,
} from '@/lib/distribution/caption-filters'

// ── Types ──

export type CaptionPlatform = 'tiktok' | 'youtube' | 'instagram'

export interface CaptionVariant {
  caption: string
  hashtags: string[]
}

export interface YouTubeVariant {
  title: string
  description: string
  tags: string[]
}

export interface DistributionCaptionResult {
  tiktok?: { variants: CaptionVariant[] }
  instagram?: { variants: CaptionVariant[] }
  youtube?: { variants: YouTubeVariant[] }
}

export interface CaptionInput {
  clipId: string
  transcript: string
  mood: ClipMood
  niche?: string
  streamerName?: string
  sourceStreamer?: string
  /** 1-3 word niche keyword (from hook generation). Aligned in caption + on-screen hook. */
  nicheKeyword?: string
  /** Clip title — strongest signal for trending clips. */
  title?: string
  platforms: CaptionPlatform[]
}

// ── Platform constraints ──

const PLATFORM_LIMITS = {
  // TikTok: soft 100 chars before hashtags, hard 150 (question may need room). 1-3 niche hashtags.
  tiktok: { captionSoft: 100, captionMax: 150, hashtagCount: 3 },
  instagram: { captionSoft: 120, captionMax: 220, hashtagCount: 5 },
  youtube: { titleMax: 60, descriptionMax: 200, tagCount: 5 },
} as const

// ── System prompt ──

const SYSTEM_PROMPT = `You are a TikTok SEO copywriter for gaming/streaming clips. TikTok indexes the words in the caption AND the on-screen text, so the caption must be searchable and specific — not hype.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "tiktok": [
    {"caption": "...", "hashtags": ["#tag1", "#tag2"]},
    {"caption": "...", "hashtags": ["#tag1", "#tag2"]},
    {"caption": "...", "hashtags": ["#tag1", "#tag2"]}
  ],
  "instagram": [
    {"caption": "...", "hashtags": ["#tag1", "#tag2"]},
    {"caption": "...", "hashtags": ["#tag1", "#tag2"]},
    {"caption": "...", "hashtags": ["#tag1", "#tag2"]}
  ],
  "youtube": [
    {"title": "...", "description": "...", "tags": ["tag1", "tag2"]},
    {"title": "...", "description": "...", "tags": ["tag1", "tag2"]},
    {"title": "...", "description": "...", "tags": ["tag1", "tag2"]}
  ]
}

Only include the platforms requested. Generate exactly 3 variants per platform.

DESCRIPTION STRUCTURE (mandatory, in this order):
1. One sentence that describes WHAT HAPPENS and contains the NICHE KEYWORD verbatim (or a direct variant).
2. One GENUINE open question to the viewer about the situation (real curiosity, not "agree?"). Questions like this get +26% comments. Exactly one question mark.
3. Credit the original streamer as @handle (if provided).
4. Then 1-3 SPECIFIC niche hashtags (game name, streamer, situation). Hashtags go in the "hashtags" array, NOT in the caption text.
Target: caption under 100 characters BEFORE hashtags (max 150 if the question needs it).

HARD BANS (instant reject):
- Generic hashtags: #fyp #foryou #foryoupage #viral #trending #xyzbca #explore #mustwatch
- Asking for likes/tags/comments (-60% interactions): ${BANNED_ENGAGEMENT_BAIT.map(p => `"${p}"`).join(', ')}
- "follow for more" anywhere except as a 3-word closer at the very END (optional)
- Vulgarity, slurs, sexual words — even censored (f*ck) — the caption is indexed and demonetised.
- Generic hype phrases: ${BANNED_HYPE_PHRASES.map(p => `"${p}"`).join(', ')}

Platform rules:
- TikTok: caption <100 chars before hashtags (max 150). 1-3 hashtags.
- Instagram Reels: caption MAX 220 chars, same structure, slightly more storytelling. 3-5 niche hashtags (still no generic ones).
- YouTube Shorts: title MAX 60 chars containing the niche keyword. description MAX 200 chars with the question + credit. 5 tags (no # prefix) = search keywords.

Style per mood:
- rage: intense, describe the exact moment, caps for one key word only
- funny: setup-punchline from actual clip content, relatable
- drama: tension from what actually happened, specific details
- wholesome: warm, reference the actual moment
- hype: describe the epic thing that happened, factual excitement
- story: narrative hook from the real content

Each variant must have a DIFFERENT sentence and a DIFFERENT question, but the same niche keyword.`

// ── Main function ──

export async function generateDistributionCaptions(
  input: CaptionInput
): Promise<DistributionCaptionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return buildFallbackResult(input)
  }

  const userMessage = buildUserMessage(input)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[CaptionEngine] Claude API ${res.status}`)
      return buildFallbackResult(input)
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) {
      return buildFallbackResult(input)
    }

    const tokensUsed = data.usage?.input_tokens + data.usage?.output_tokens

    const parsed = parseResponse(textBlock.text, input)
    return { ...parsed, _tokensUsed: tokensUsed } as DistributionCaptionResult & { _tokensUsed?: number }
  } catch (err) {
    console.error(`[CaptionEngine] Error: ${err instanceof Error ? err.message : String(err)}`)
    return buildFallbackResult(input)
  }
}

// ── User message builder ──

function buildUserMessage(input: CaptionInput): string {
  const parts: string[] = []
  parts.push(`Platforms: ${input.platforms.join(', ')}`)
  parts.push(`Mood: ${input.mood}`)
  if (input.nicheKeyword) parts.push(`NICHE KEYWORD (must appear verbatim in every caption/title): ${input.nicheKeyword}`)
  if (input.title) parts.push(`Clip title: ${input.title}`)
  if (input.niche) parts.push(`Niche: ${input.niche}`)
  if (input.streamerName) parts.push(`Streamer: ${input.streamerName}`)
  if (input.sourceStreamer) parts.push(`Credit original streamer as @${input.sourceStreamer.replace(/^@/, '')}`)
  parts.push(`Transcript: ${input.transcript.slice(0, 1500)}`)
  return parts.join('\n')
}

// ── Response parser ──

function parseResponse(
  text: string,
  input: CaptionInput,
): DistributionCaptionResult {
  const requestedPlatforms = input.platforms
  const handle = input.sourceStreamer?.replace(/^@/, '') ?? null
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}

    const raw = JSON.parse(jsonMatch[0])
    const result: DistributionCaptionResult = {}

    if (requestedPlatforms.includes('tiktok') && Array.isArray(raw.tiktok)) {
      result.tiktok = {
        variants: raw.tiktok.slice(0, 3).map((v: { caption?: string; hashtags?: string[] }) => {
          const s = sanitizeDescription({
            caption: String(v.caption ?? ''),
            hashtags: v.hashtags,
            nicheKeyword: input.nicheKeyword,
            streamerHandle: handle,
            softMax: PLATFORM_LIMITS.tiktok.captionSoft,
            hardMax: PLATFORM_LIMITS.tiktok.captionMax,
            maxHashtags: PLATFORM_LIMITS.tiktok.hashtagCount,
          })
          if (s.warnings.length) console.warn(`[CaptionEngine] tiktok variant warnings: ${s.warnings.join(',')}`)
          return { caption: s.caption, hashtags: s.hashtags }
        }),
      }
    }

    if (requestedPlatforms.includes('instagram') && Array.isArray(raw.instagram)) {
      result.instagram = {
        variants: raw.instagram.slice(0, 3).map((v: { caption?: string; hashtags?: string[] }) => {
          const s = sanitizeDescription({
            caption: String(v.caption ?? ''),
            hashtags: v.hashtags,
            nicheKeyword: input.nicheKeyword,
            streamerHandle: handle,
            softMax: PLATFORM_LIMITS.instagram.captionSoft,
            hardMax: PLATFORM_LIMITS.instagram.captionMax,
            maxHashtags: PLATFORM_LIMITS.instagram.hashtagCount,
          })
          return { caption: s.caption, hashtags: s.hashtags }
        }),
      }
    }

    if (requestedPlatforms.includes('youtube') && Array.isArray(raw.youtube)) {
      result.youtube = {
        variants: raw.youtube.slice(0, 3).map((v: { title?: string; description?: string; tags?: string[] }) => {
          const desc = sanitizeDescription({
            caption: String(v.description ?? ''),
            hashtags: [],
            nicheKeyword: input.nicheKeyword,
            streamerHandle: handle,
            softMax: PLATFORM_LIMITS.youtube.descriptionMax,
            hardMax: PLATFORM_LIMITS.youtube.descriptionMax,
            maxHashtags: 0,
          })
          return {
            title: enforceLength(stripBannedWords(stripBannedPhrases(String(v.title ?? ''))), PLATFORM_LIMITS.youtube.titleMax),
            description: desc.caption,
            tags: normalizeTags(v.tags, PLATFORM_LIMITS.youtube.tagCount),
          }
        }),
      }
    }

    return result
  } catch {
    return {}
  }
}

// ── Enforcement helpers ──

function enforceLength(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

function normalizeTags(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.replace(/^#/, '').trim())
    .filter(t => t.length > 0 && !['fyp', 'foryou', 'viral', 'trending'].includes(t.toLowerCase()))
    .slice(0, max)
}

// ── Fallback (template-based) ──

function slugTag(s: string): string {
  const slug = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return slug.length >= 3 ? `#${slug}` : ''
}

function buildFallbackResult(input: CaptionInput): DistributionCaptionResult {
  const result: DistributionCaptionResult = {}
  const streamer = input.streamerName || input.sourceStreamer || 'this streamer'
  const handle = input.sourceStreamer?.replace(/^@/, '') ?? null
  const kw = input.nicheKeyword?.trim() || input.niche?.trim() || 'stream'
  const Kw = kw.charAt(0).toUpperCase() + kw.slice(1)

  // [keyword sentence] + [open question] — credit/hashtags added by sanitizeDescription
  const sentences: Record<ClipMood, string[]> = {
    rage: [`${Kw}: ${streamer} completely lost it live.`, `Peak ${kw} tilt from ${streamer}.`, `${streamer} snapped over ${kw}.`],
    funny: [`${streamer} turned ${kw} into a comedy bit.`, `The ${kw} timing here is unreal.`, `${streamer} did not plan this ${kw} moment.`],
    drama: [`${kw} took a turn nobody planned on ${streamer}'s stream.`, `Tense ${kw} moment with ${streamer}.`, `${streamer} vs ${kw} — this got serious.`],
    wholesome: [`${streamer} had the most wholesome ${kw} moment.`, `A genuinely sweet ${kw} moment on stream.`, `${kw} but make it heartwarming.`],
    hype: [`${streamer} just pulled off this ${kw} play.`, `Clean ${kw} moment from ${streamer}.`, `${Kw} peak from ${streamer}'s stream.`],
    story: [`${streamer} explains what happened with ${kw}.`, `The ${kw} story behind this clip.`, `${streamer} on ${kw}, uncut.`],
  }
  const questions = [
    'Would you have reacted the same way?',
    'What would you have done here?',
    'Is this the best or worst take you have seen?',
  ]
  const base = sentences[input.mood] ?? sentences.hype
  const fallbackTags = filterHashtags([slugTag(kw), input.niche ? slugTag(input.niche) : '', handle ? slugTag(handle) : '', '#clips'], 3)

  const build = (i: number, softMax: number, hardMax: number, maxHashtags: number) => {
    const s = sanitizeDescription({
      caption: `${base[i % base.length]} ${questions[i % questions.length]}`,
      hashtags: fallbackTags,
      nicheKeyword: input.nicheKeyword,
      streamerHandle: handle,
      softMax, hardMax, maxHashtags,
    })
    return { caption: s.caption, hashtags: s.hashtags }
  }

  if (input.platforms.includes('tiktok')) {
    result.tiktok = {
      variants: [0, 1, 2].map(i => build(i, PLATFORM_LIMITS.tiktok.captionSoft, PLATFORM_LIMITS.tiktok.captionMax, PLATFORM_LIMITS.tiktok.hashtagCount)),
    }
  }

  if (input.platforms.includes('instagram')) {
    result.instagram = {
      variants: [0, 1, 2].map(i => build(i, PLATFORM_LIMITS.instagram.captionSoft, PLATFORM_LIMITS.instagram.captionMax, PLATFORM_LIMITS.instagram.hashtagCount)),
    }
  }

  if (input.platforms.includes('youtube')) {
    result.youtube = {
      variants: [0, 1, 2].map(i => {
        const v = build(i, PLATFORM_LIMITS.youtube.descriptionMax, PLATFORM_LIMITS.youtube.descriptionMax, 0)
        return {
          title: enforceLength(`${Kw} — ${streamer} clip`, PLATFORM_LIMITS.youtube.titleMax),
          description: v.caption,
          tags: [kw, 'gaming', 'clips', 'streamer', input.mood].filter(Boolean).slice(0, PLATFORM_LIMITS.youtube.tagCount),
        }
      }),
    }
  }

  return result
}
