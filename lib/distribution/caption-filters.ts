/**
 * Caption Filters — single source of truth for description/caption hygiene.
 *
 * Data-backed rules (RECHERCHE-ALGO-VIRALITE-2026, Partie 5-7):
 *   - Generic hashtags (#fyp, #viral, #foryou...) are ignored by TikTok SEO and
 *     correlate with spam accounts → hard ban.
 *   - Asking for likes = -60% interactions → engagement-bait phrases banned.
 *   - A genuine open question in the description = +26% comments → enforced
 *     softly (prompt + `hasOpenQuestion` check).
 *   - One niche keyword aligned everywhere (hook on screen + description).
 *
 * Used by: lib/ai/caption-engine.ts (AI captions), lib/distribution/caption-engine.ts
 * (template fallback), lib/distribution/caption-diversifier.ts (publish variants).
 */

// ── Hashtags ───────────────────────────────────────────────────────────────

/** Generic / spam-trigger hashtags — NEVER emitted, stripped in post-filter. */
export const BANNED_HASHTAGS: ReadonlySet<string> = new Set([
  '#fyp', '#fypage', '#fypシ', '#foryou', '#foryoupage', '#for_you',
  '#viral', '#viralvideo', '#viralclip', '#goviral', '#trending', '#trend',
  '#xyzbca', '#mustwatch', '#watchthis', '#explore', '#explorepage',
  '#blowup', '#blowthisup', '#algorithm',
])

// ── Engagement bait ────────────────────────────────────────────────────────

/**
 * Phrases that ask for likes/comments/tags. Removed wherever they appear.
 * "follow for more" is handled separately (allowed ONLY at the very end).
 */
export const BANNED_ENGAGEMENT_BAIT: readonly string[] = [
  'like if', 'like this if', 'like and follow', 'like & follow',
  'tag a friend', 'tag someone', 'tag your friend', 'tag your friends',
  'comment yes', 'comment if', 'comment below if', 'comment your',
  'double tap', 'smash that like', 'smash the like',
  'hit the like', 'hit like', 'drop a like',
  'leave a like', 'give this a like', 'like for part',
  'share this with', 'share with a friend', 'send this to',
  'save this', 'save for later',
]

/** Generic hype phrases TikTok associates with spam (quality gate 881c24b). */
export const BANNED_HYPE_PHRASES: readonly string[] = [
  'broke the internet', 'i\'m actually shaking', 'this is insane',
  'you won\'t believe', 'wait for it', 'nobody expected',
  'gone wrong', 'goes crazy', 'watch till the end',
  'i can\'t believe', 'literally crying', 'i\'m screaming',
  'no way this is real', 'this changed everything',
  'the internet is broken', 'legendary moment', 'i\'m dead',
  'most insane',
]

// ── Vulgarity / slurs ──────────────────────────────────────────────────────

/**
 * Words that get a clip demonetised / shadow-limited when present in caption
 * or on-screen text. Kept short on purpose: this is a safety net, the prompt
 * already forbids vulgarity. Matched as whole words, case-insensitive.
 */
export const BANNED_WORDS: readonly string[] = [
  'fuck', 'fucking', 'fucked', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'retard', 'retarded',
  'faggot', 'fag', 'nigga', 'nigger', 'kys', 'rape', 'nazi',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collapseWhitespace(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/([,.!?]){2,}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Remove generic hype phrases (legacy behaviour of stripBannedPhrases). */
export function stripBannedPhrases(text: string): string {
  let cleaned = text
  for (const phrase of BANNED_HYPE_PHRASES) {
    cleaned = cleaned.replace(new RegExp(escapeRegex(phrase), 'gi'), '')
  }
  return collapseWhitespace(cleaned)
}

/** Remove engagement-bait sentences ("like if...", "tag a friend"...). */
export function stripEngagementBait(text: string): string {
  let cleaned = text
  for (const phrase of BANNED_ENGAGEMENT_BAIT) {
    // Remove the whole sentence fragment containing the bait (up to next punctuation / newline)
    const re = new RegExp(`[^.!?\\n]*${escapeRegex(phrase)}[^.!?\\n]*[.!?]?`, 'gi')
    cleaned = cleaned.replace(re, '')
  }
  return collapseWhitespace(cleaned)
}

/**
 * "follow for more" is allowed ONLY as a short closing phrase at the end.
 * If it appears at the start or mid-text, it is removed there.
 */
export function normalizeFollowCta(text: string): string {
  const re = /follow (?:me |us )?for more[^.!?\n]*[.!?]?/gi
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return text
  const last = matches[matches.length - 1]
  const lastEnd = (last.index ?? 0) + last[0].length
  const tail = text.slice(lastEnd).trim()
  const isAtEnd = tail.length === 0 || /^#/.test(tail)
  // Remove all occurrences...
  let cleaned = text.replace(re, '')
  // ...and re-append a short version if the last one was genuinely at the end
  if (isAtEnd) cleaned = `${collapseWhitespace(cleaned)} Follow for more.`
  return collapseWhitespace(cleaned)
}

/** Replace banned words by a neutral placeholder-free removal (whole word). */
export function stripBannedWords(text: string): string {
  let cleaned = text
  for (const w of BANNED_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(w)}\\b`, 'gi'), '')
  }
  return collapseWhitespace(cleaned)
}

/** True if text contains a banned word (whole word). */
export function containsBannedWord(text: string): boolean {
  const lower = text.toLowerCase()
  return BANNED_WORDS.some(w => new RegExp(`\\b${escapeRegex(w)}\\b`).test(lower))
}

/** Remove any banned hashtag tokens inline in a text. */
export function stripBannedHashtagsFromText(text: string): string {
  return collapseWhitespace(
    text.replace(/#[\p{L}\p{N}_]+/gu, (tag) => (BANNED_HASHTAGS.has(tag.toLowerCase()) ? '' : tag)),
  )
}

/** Filter a hashtag list: normalise `#`, dedupe, drop banned/generic ones, cap count. */
export function filterHashtags(raw: unknown, max = 3): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const h of raw) {
    if (typeof h !== 'string') continue
    const tag = (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`).replace(/\s+/g, '')
    const key = tag.toLowerCase()
    if (tag.length < 3 || BANNED_HASHTAGS.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= max) break
  }
  return out
}

/** True if the text contains at least one real question mark sentence. */
export function hasOpenQuestion(text: string): boolean {
  return /\?/.test(text)
}

/** Case-insensitive keyword presence check (also matches simple plural/variants). */
export function containsKeyword(text: string, keyword?: string | null): boolean {
  if (!keyword) return true
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  const lower = text.toLowerCase()
  if (lower.includes(kw)) return true
  // Tolerate hashtag-form or squashed variant ("apex legends" → "apexlegends")
  const squashed = kw.replace(/\s+/g, '')
  return lower.replace(/\s+/g, '').includes(squashed)
}

export interface SanitizeDescriptionInput {
  caption: string
  hashtags?: unknown
  /** Niche keyword that must appear in the caption (soft — prepended if missing). */
  nicheKeyword?: string | null
  /** Streamer handle to credit (without @). Appended if missing. */
  streamerHandle?: string | null
  /** Soft length limit before hashtags (default 100, hard 150). */
  softMax?: number
  hardMax?: number
  maxHashtags?: number
}

export interface SanitizeDescriptionResult {
  caption: string
  hashtags: string[]
  warnings: string[]
}

/**
 * Full post-filter for a generated description:
 *  1. strip banned hashtags inline, hype phrases, engagement bait, vulgarity
 *  2. normalise the follow CTA (end only)
 *  3. guarantee keyword + @credit presence
 *  4. enforce length (soft 100 / hard 150 before hashtags)
 *  5. filter hashtag list (1-3 niche tags, no generic ones)
 */
export function sanitizeDescription(input: SanitizeDescriptionInput): SanitizeDescriptionResult {
  const softMax = input.softMax ?? 100
  const hardMax = input.hardMax ?? 150
  const warnings: string[] = []

  let caption = String(input.caption ?? '')
  caption = stripBannedHashtagsFromText(caption)
  caption = stripBannedPhrases(caption)
  caption = stripEngagementBait(caption)
  caption = stripBannedWords(caption)
  caption = normalizeFollowCta(caption)

  // Keyword alignment (soft): prepend a short sentence if missing
  const kw = input.nicheKeyword?.trim()
  if (kw && !containsKeyword(caption, kw)) {
    warnings.push('keyword_missing')
    caption = collapseWhitespace(`${kw[0].toUpperCase()}${kw.slice(1)} moment. ${caption}`)
  }

  // Credit
  const handle = input.streamerHandle?.replace(/^@/, '').trim()
  if (handle && !caption.toLowerCase().includes(`@${handle.toLowerCase()}`)) {
    caption = collapseWhitespace(`${caption} @${handle}`)
  }

  if (!hasOpenQuestion(caption)) warnings.push('no_question')

  // Length: soft 100, hard 150 (before hashtags)
  if (caption.length > hardMax) {
    warnings.push('too_long')
    // Try to cut at a sentence boundary before hardMax, keep the @credit
    const creditMatch = handle ? new RegExp(`\\s*@${escapeRegex(handle)}\\s*$`, 'i') : null
    const credit = creditMatch && creditMatch.test(caption) ? ` @${handle}` : ''
    let body = credit ? caption.replace(creditMatch as RegExp, '') : caption
    const limit = hardMax - credit.length
    if (body.length > limit) {
      const cut = body.slice(0, limit)
      const lastPunct = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
      body = lastPunct > limit * 0.5 ? cut.slice(0, lastPunct + 1) : cut.slice(0, limit - 1).trimEnd() + '…'
    }
    caption = collapseWhitespace(body + credit)
  } else if (caption.length > softMax) {
    warnings.push('over_soft_limit')
  }

  const hashtags = filterHashtags(input.hashtags, input.maxHashtags ?? 3)

  return { caption, hashtags, warnings }
}
