/**
 * AI Caption Engine for Distribution.
 * Generates platform-specific captions + hashtags via Claude Haiku.
 * Graceful fallback to templates if API unavailable.
 */

import type { ClipMood } from './mood-presets'

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
  platforms: CaptionPlatform[]
}

// ── Platform constraints ──

const PLATFORM_LIMITS = {
  tiktok: { captionMax: 150, hashtagCount: 8 },
  instagram: { captionMax: 220, hashtagCount: 12 },
  youtube: { titleMax: 60, descriptionMax: 200, tagCount: 5 },
} as const

// ── System prompt ──

const SYSTEM_PROMPT = `You are a viral social media caption writer for gaming/streaming clip content. You write captions optimized for maximum engagement on each platform.

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

Platform rules:
- TikTok: caption MAX 150 chars. 8 hashtags. Hook in first line. Use trending lingo, short punchy sentences. Algorithm favors watch-time hooks ("wait for it", "you won't believe").
- Instagram Reels: caption MAX 220 chars. 12 hashtags. More descriptive, storytelling angle. Mix broad reach hashtags (#viral, #fyp) with niche ones.
- YouTube Shorts: title MAX 60 chars. description MAX 200 chars. 5 tags (no # prefix). Title must be clickbait-y but honest. Description adds context. Tags are search-optimized keywords.

Style per mood:
- rage: aggressive, caps for emphasis, shock value
- funny: humor, setup-punchline, relatable
- drama: tension, mystery, "you need to see this"
- wholesome: warm, emotional, share-worthy
- hype: excitement, epic moments, "INSANE"
- story: narrative hook, curiosity gap

If a sourceStreamer is provided, credit them naturally (e.g. "@streamer just did THIS").
Each variant should have a different angle/hook — don't just rephrase the same thing.`

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

    const parsed = parseResponse(textBlock.text, input.platforms)
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
  if (input.niche) parts.push(`Niche: ${input.niche}`)
  if (input.streamerName) parts.push(`Streamer: ${input.streamerName}`)
  if (input.sourceStreamer) parts.push(`Credit original streamer: ${input.sourceStreamer}`)
  parts.push(`Transcript: ${input.transcript.slice(0, 1500)}`)
  return parts.join('\n')
}

// ── Response parser ──

function parseResponse(
  text: string,
  requestedPlatforms: CaptionPlatform[],
): DistributionCaptionResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}

    const raw = JSON.parse(jsonMatch[0])
    const result: DistributionCaptionResult = {}

    if (requestedPlatforms.includes('tiktok') && Array.isArray(raw.tiktok)) {
      result.tiktok = {
        variants: raw.tiktok.slice(0, 3).map((v: { caption?: string; hashtags?: string[] }) => ({
          caption: enforceLength(String(v.caption ?? ''), PLATFORM_LIMITS.tiktok.captionMax),
          hashtags: normalizeHashtags(v.hashtags, PLATFORM_LIMITS.tiktok.hashtagCount),
        })),
      }
    }

    if (requestedPlatforms.includes('instagram') && Array.isArray(raw.instagram)) {
      result.instagram = {
        variants: raw.instagram.slice(0, 3).map((v: { caption?: string; hashtags?: string[] }) => ({
          caption: enforceLength(String(v.caption ?? ''), PLATFORM_LIMITS.instagram.captionMax),
          hashtags: normalizeHashtags(v.hashtags, PLATFORM_LIMITS.instagram.hashtagCount),
        })),
      }
    }

    if (requestedPlatforms.includes('youtube') && Array.isArray(raw.youtube)) {
      result.youtube = {
        variants: raw.youtube.slice(0, 3).map((v: { title?: string; description?: string; tags?: string[] }) => ({
          title: enforceLength(String(v.title ?? ''), PLATFORM_LIMITS.youtube.titleMax),
          description: enforceLength(String(v.description ?? ''), PLATFORM_LIMITS.youtube.descriptionMax),
          tags: normalizeTags(v.tags, PLATFORM_LIMITS.youtube.tagCount),
        })),
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
  return text.slice(0, max - 1) + '\u2026'
}

function normalizeHashtags(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h): h is string => typeof h === 'string')
    .map(h => h.startsWith('#') ? h : `#${h}`)
    .slice(0, max)
}

function normalizeTags(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.replace(/^#/, ''))
    .slice(0, max)
}

// ── Fallback (template-based) ──

function buildFallbackResult(input: CaptionInput): DistributionCaptionResult {
  const result: DistributionCaptionResult = {}
  const title = input.streamerName || 'this streamer'
  const credit = input.sourceStreamer ? ` by @${input.sourceStreamer}` : ''

  const hooks = {
    rage: ['STOP SCROLLING.', 'The most TILTED moment ever.', 'Nobody was ready for this rage.'],
    funny: ['I can\'t stop laughing.', 'Comedy GOLD right here.', 'This is TOO funny.'],
    drama: ['Nobody is talking about this.', 'This changes EVERYTHING.', 'Watch till the end.'],
    wholesome: ['This restored my faith.', 'Pure serotonin.', 'You NEED to see this.'],
    hype: ['This shouldn\'t be possible.', 'INSANE moment right here.', 'Wait for it...'],
    story: ['Let me explain what happened.', 'The story behind this clip.', 'You won\'t believe this.'],
  }

  const moodHooks = hooks[input.mood] || hooks.hype

  if (input.platforms.includes('tiktok')) {
    result.tiktok = {
      variants: moodHooks.map(hook => ({
        caption: enforceLength(`${hook} ${title}${credit} just did something INSANE`, PLATFORM_LIMITS.tiktok.captionMax),
        hashtags: ['#viral', '#fyp', '#clips', '#gaming', '#streamer', '#trending', '#foryou', '#omg'],
      })),
    }
  }

  if (input.platforms.includes('instagram')) {
    result.instagram = {
      variants: moodHooks.map(hook => ({
        caption: enforceLength(`${hook} Check out this incredible moment from ${title}${credit}. You won't see this anywhere else.`, PLATFORM_LIMITS.instagram.captionMax),
        hashtags: ['#viral', '#fyp', '#clips', '#gaming', '#streamer', '#trending', '#reels', '#explore', '#foryou', '#omg', '#highlights', '#content'],
      })),
    }
  }

  if (input.platforms.includes('youtube')) {
    result.youtube = {
      variants: moodHooks.map(hook => ({
        title: enforceLength(`${hook} ${title} clip`, PLATFORM_LIMITS.youtube.titleMax),
        description: enforceLength(`${hook} Watch this incredible ${input.mood} moment from ${title}${credit}. Subscribe for more viral clips!`, PLATFORM_LIMITS.youtube.descriptionMax),
        tags: ['gaming', 'clips', 'streamer', 'viral', input.mood],
      })),
    }
  }

  return result
}
