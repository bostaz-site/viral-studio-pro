/**
 * AI Voiceover Script Writer — generates short commentary lines
 * timed to gaps in the streamer's speech, using Claude Haiku.
 *
 * Input: Whisper word timestamps, clip title, streamer name, niche, audio peaks.
 * Output: 2-4 timed commentary lines that add context/anticipation without
 * repeating what the streamer says or talking over key moments.
 */

import { logAiCall } from './call-logger'

export interface VoiceoverLine {
  text: string
  startTime: number
  /** Estimated duration in seconds (used for ducking window) */
  estimatedDuration: number
  role: 'hook' | 'reaction' | 'closer'
}

export interface VoiceoverScript {
  lines: VoiceoverLine[]
  voice: string
}

interface WordTimestamp {
  word: string
  start: number
  end: number
}

/**
 * Find silence gaps (>= minGap seconds) in word timestamps.
 * Returns array of { start, end, duration }.
 */
function findSilenceGaps(
  words: WordTimestamp[],
  clipDuration: number,
  minGap = 0.6,
): { start: number; end: number; duration: number }[] {
  const gaps: { start: number; end: number; duration: number }[] = []

  // Gap at the very start (before first word)
  if (words.length > 0 && words[0].start >= minGap) {
    gaps.push({ start: 0, end: words[0].start, duration: words[0].start })
  }

  // Gaps between words
  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].end
    const gapEnd = words[i + 1].start
    const dur = gapEnd - gapStart
    if (dur >= minGap) {
      gaps.push({ start: gapStart, end: gapEnd, duration: dur })
    }
  }

  // Gap at the end (after last word)
  if (words.length > 0) {
    const lastEnd = words[words.length - 1].end
    const endGap = clipDuration - lastEnd
    if (endGap >= minGap) {
      gaps.push({ start: lastEnd, end: clipDuration, duration: endGap })
    }
  }

  return gaps
}

/**
 * Generate voiceover script using Claude Haiku.
 * Returns null on any failure — render continues without voiceover.
 */
export async function generateVoiceoverScript(params: {
  wordTimestamps: WordTimestamp[]
  clipTitle: string
  streamerName: string
  niche: string
  clipDuration: number
  audioPeakTimes: number[]
  userId?: string
}): Promise<VoiceoverScript | null> {
  const { wordTimestamps, clipTitle, streamerName, niche, clipDuration, audioPeakTimes, userId } = params

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const transcript = wordTimestamps.map(w => w.word).join(' ').trim()
  if (!transcript || transcript.length < 10) return null

  const gaps = findSilenceGaps(wordTimestamps, clipDuration, 0.6)
  const gapsDescription = gaps.length > 0
    ? gaps.map(g => `${g.start.toFixed(1)}-${g.end.toFixed(1)}s (${g.duration.toFixed(1)}s gap)`).join(', ')
    : 'No clear silence gaps found'

  const peaksDescription = audioPeakTimes.length > 0
    ? audioPeakTimes.map(t => `${t.toFixed(1)}s`).join(', ')
    : 'No peaks detected'

  const prompt = `You are writing voiceover commentary for a short clip being posted on TikTok.

CLIP INFO:
- Title: "${clipTitle}"
- Streamer: ${streamerName}
- Niche: ${niche || 'gaming'}
- Duration: ${clipDuration.toFixed(1)}s
- Transcript: "${transcript.slice(0, 1500)}"
- Silence gaps: ${gapsDescription}
- Audio peaks (hype moments): ${peaksDescription}

RULES:
1. Write 2-4 SHORT commentary lines (5-10 words each, max 12)
2. Each line has a role: "hook" (first 0-2s, builds anticipation), "reaction" (on/near a peak), or "closer" (last 2s)
3. You MUST include exactly 1 hook line placed in the first 1.5 seconds
4. Place reaction lines NEAR peak times or in silence gaps — NEVER during key streamer dialogue
5. Tone: casual clipper/commentator. Hype but not cringe. No "you won't believe this", no "this will go viral"
6. NEVER describe what's visible on screen. Add context, anticipation, or insider reaction
7. NEVER talk over an important streamer line — use the silence gaps provided
8. Each line needs a startTime (seconds from clip start) and estimatedDuration (how long to speak it, typically 1.0-2.0s)

Return ONLY a JSON array. Example:
[
  {"text": "watch this play closely", "startTime": 0.2, "role": "hook", "estimatedDuration": 1.3},
  {"text": "no way he hits that", "startTime": 8.5, "role": "reaction", "estimatedDuration": 1.2},
  {"text": "absolute legend", "startTime": 14.0, "role": "closer", "estimatedDuration": 1.0}
]`

  const startMs = Date.now()
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error(`[VoiceoverWriter] Claude API error: ${response.status}`)
      return null
    }

    const result = await response.json() as {
      content: { text: string }[]
      usage?: { input_tokens: number; output_tokens: number }
    }
    const text = result.content?.[0]?.text || ''

    // Log cost
    const latencyMs = Date.now() - startMs
    logAiCall({
      userId,
      model: 'claude-haiku-4-5-20251001',
      feature: 'voiceover_script',
      tokensInput: result.usage?.input_tokens,
      tokensOutput: result.usage?.output_tokens,
      latencyMs,
      success: true,
    }).catch(() => {})

    // Parse JSON from response (may have markdown fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[VoiceoverWriter] Could not parse JSON from response')
      return null
    }

    const lines = JSON.parse(jsonMatch[0]) as VoiceoverLine[]

    // Validate and sanitize
    const validLines = lines
      .filter(l =>
        l.text && typeof l.text === 'string' && l.text.length > 0 && l.text.length <= 80 &&
        typeof l.startTime === 'number' && l.startTime >= 0 && l.startTime < clipDuration &&
        typeof l.estimatedDuration === 'number' && l.estimatedDuration > 0 && l.estimatedDuration <= 4 &&
        ['hook', 'reaction', 'closer'].includes(l.role)
      )
      .slice(0, 4)
      .sort((a, b) => a.startTime - b.startTime)

    if (validLines.length === 0) {
      console.warn('[VoiceoverWriter] No valid lines after sanitization')
      return null
    }

    console.log(`[VoiceoverWriter] Generated ${validLines.length} lines in ${latencyMs}ms`)
    return { lines: validLines, voice: 'default' }
  } catch (err) {
    console.error('[VoiceoverWriter] Error:', (err as Error).message)
    logAiCall({
      userId,
      model: 'claude-haiku-4-5-20251001',
      feature: 'voiceover_script',
      latencyMs: Date.now() - startMs,
      success: false,
      error: (err as Error).message,
    }).catch(() => {})
    return null
  }
}
