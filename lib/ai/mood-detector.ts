/**
 * Mood detection via Claude Haiku.
 * Analyzes clip transcript/title to determine the dominant mood.
 */

import type { ClipMood } from './mood-presets'
import { logAiCall } from './call-logger'

export interface MoodDetectionResult {
  mood: ClipMood
  confidence: number
  explanation: string
  secondary_mood?: ClipMood
  important_words?: string[]
  caption_reason?: string
  emphasis_reason?: string
  hook_reason?: string
}

const VALID_MOODS: ClipMood[] = ['rage', 'funny', 'drama', 'wholesome', 'hype', 'story']

const SYSTEM_PROMPT = `You are a clip mood analyzer for a viral video editing app. Analyze the given clip transcript, title, and context to determine the dominant mood AND identify the most impactful words for subtitle emphasis.

Return ONLY valid JSON with this exact structure:
{"mood": "...", "confidence": 0-100, "explanation": "...", "secondary_mood": "...", "important_words": ["word1", "word2", ...], "caption_reason": "...", "emphasis_reason": "...", "hook_reason": "..."}

Additional fields (1 short sentence each, max 150 chars, specific to THIS clip):
- caption_reason: why you chose this caption style for this clip's content
- emphasis_reason: why the emphasis effect fits this clip's energy
- hook_reason: why this hook approach works for this clip's retention

The mood MUST be exactly one of: rage, funny, drama, wholesome, hype, story

Mood definitions:
- rage: screaming, anger, frustration, slamming, swearing, aggressive vocabulary, raised voice
- funny: laughter, jokes, absurd situations, funny reactions, light tone
- drama: confrontation, tension, beef, accusations, serious/intense tone
- wholesome: touching moments, donations, gratitude, soft/emotional tone
- hype: victory, celebration, epic moments, crowd cheering, over-excited tone
- story: narration, monologue, explanation, story being told, steady/continuous tone

Rules:
- confidence: how sure you are (0-100). If the transcript is short or ambiguous, lower confidence.
- explanation: 1 short sentence explaining WHY this mood was detected
- secondary_mood: optional, only if there's a clear secondary mood (different from primary)
- important_words: 3-8 words from the transcript that should be visually emphasized in karaoke captions. Pick words that are emotionally loaded, surprising, or key to the clip's hook. Lowercase only. Examples: names, slang, exclamations, punchline words, numbers/money amounts.
- If the transcript is empty or unclear, default to "hype" with low confidence and empty important_words`

export async function detectMood(
  transcript: string,
  title?: string,
  streamer?: string,
  niche?: string
): Promise<MoodDetectionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return fallbackResult('No API key configured')
  }

  const userMessage = buildUserMessage(transcript, title, streamer, niche)

  const startMs = Date.now()
  const MODEL = 'claude-haiku-4-5-20251001'

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
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const latencyMs = Date.now() - startMs

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      console.error(`[MoodDetector] Claude API ${res.status}: ${errText}`)
      logAiCall({ model: MODEL, feature: 'mood_detection', latencyMs, success: false, error: `HTTP ${res.status}` })
      return fallbackResult(`API error: ${res.status}`)
    }

    const data = await res.json()
    const tokensInput = data.usage?.input_tokens as number | undefined
    const tokensOutput = data.usage?.output_tokens as number | undefined

    logAiCall({
      model: MODEL,
      feature: 'mood_detection',
      tokensInput,
      tokensOutput,
      latencyMs,
      success: true,
      metadata: { title, streamer },
    })

    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) {
      return fallbackResult('No text in response')
    }

    return parseMoodResponse(textBlock.text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const latencyMs = Date.now() - startMs
    console.error(`[MoodDetector] Error: ${msg}`)
    logAiCall({ model: MODEL, feature: 'mood_detection', latencyMs, success: false, error: msg })
    return fallbackResult(msg)
  }
}

function buildUserMessage(
  transcript: string,
  title?: string,
  streamer?: string,
  niche?: string
): string {
  const parts: string[] = []
  if (title) parts.push(`Title: ${title}`)
  if (streamer) parts.push(`Streamer: ${streamer}`)
  if (niche) parts.push(`Niche: ${niche}`)
  parts.push(`Transcript: ${transcript.slice(0, 2000)}`)
  return parts.join('\n')
}

function parseMoodResponse(text: string): MoodDetectionResult {
  try {
    // Extract JSON from the response (Claude might wrap it in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallbackResult('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])

    const mood = VALID_MOODS.includes(parsed.mood) ? parsed.mood as ClipMood : 'hype'
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(100, parsed.confidence))
      : 50
    const explanation = typeof parsed.explanation === 'string'
      ? parsed.explanation.slice(0, 200)
      : 'Mood detected from transcript analysis'
    const secondaryMood = parsed.secondary_mood && VALID_MOODS.includes(parsed.secondary_mood) && parsed.secondary_mood !== mood
      ? parsed.secondary_mood as ClipMood
      : undefined
    const importantWords = Array.isArray(parsed.important_words)
      ? parsed.important_words.filter((w: unknown) => typeof w === 'string').map((w: string) => w.toLowerCase()).slice(0, 10)
      : undefined

    const captionReason = typeof parsed.caption_reason === 'string'
      ? parsed.caption_reason.slice(0, 150) : undefined
    const emphasisReason = typeof parsed.emphasis_reason === 'string'
      ? parsed.emphasis_reason.slice(0, 150) : undefined
    const hookReason = typeof parsed.hook_reason === 'string'
      ? parsed.hook_reason.slice(0, 150) : undefined

    return {
      mood, confidence, explanation, secondary_mood: secondaryMood, important_words: importantWords,
      caption_reason: captionReason, emphasis_reason: emphasisReason, hook_reason: hookReason,
    }
  } catch {
    return fallbackResult('Failed to parse response')
  }
}

function fallbackResult(reason: string): MoodDetectionResult {
  console.warn(`[MoodDetector] Fallback to hype: ${reason}`)
  return {
    mood: 'hype',
    confidence: 30,
    explanation: 'Default preset applied (mood detection unavailable)',
  }
}
