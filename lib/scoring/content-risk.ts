/**
 * Content Risk Detection — flags clips that TikTok restricts.
 *
 * TikTok's "Regulated Goods" policy restricts gambling, violence, and mature
 * content from the For You feed. Repeated violations degrade account reputation.
 *
 * Detection layers:
 * 1. Title keyword matching (case-insensitive, word-boundary where possible)
 * 2. Streamer niche inheritance (niche = 'gambling'/'slots' → all clips flagged)
 * 3. Streamer auto-learning (>=60% of recent clips flagged → streamer flagged)
 */

export type ContentRisk = 'gambling' | 'violence' | 'mature'

// ── Keyword dictionaries ─────────────────────────────────────────────────────

const GAMBLING_KEYWORDS = [
  'casino', 'slots', 'slot', 'baccarat', 'blackjack', 'roulette', 'jackpot',
  'stake', 'gamba', 'gambling', 'bet', 'bets', 'wager', 'poker', 'parlay',
  'degen', 'bonus buy', 'max win', 'pokies', 'gamble', 'sportsbet',
  'stake\\.com', 'rollbit', 'duelbits', 'shuffle\\.com',
]

const VIOLENCE_KEYWORDS = [
  'fight', 'knockout', "ko'd", 'jumped', 'brawl', 'beat up', 'beatdown',
  'stabbed', 'shooting',
]

const MATURE_KEYWORDS = [
  'strip', 'onlyfans', '18\\+', 'nsfw', 'nude',
]

// Build regex for each category — word boundary (\b) for short words to avoid
// false positives ("bet" inside "better"), but substring match for multi-word
// phrases ("bonus buy", "beat up").
function buildRegex(keywords: string[]): RegExp {
  const patterns = keywords.map(kw => {
    // Multi-word or regex-containing → use as-is
    if (kw.includes(' ') || kw.includes('\\')) return kw
    // Short words (<=4 chars) need word boundaries to avoid false positives
    if (kw.length <= 4) return `\\b${kw}\\b`
    return kw
  })
  return new RegExp(`(?:${patterns.join('|')})`, 'i')
}

const GAMBLING_RE = buildRegex(GAMBLING_KEYWORDS)
const VIOLENCE_RE = buildRegex(VIOLENCE_KEYWORDS)
const MATURE_RE = buildRegex(MATURE_KEYWORDS)

// Niches that automatically flag all clips
const GAMBLING_NICHES = new Set(['gambling', 'slots', 'casino'])

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect content risk from clip title and optional streamer niche.
 * Returns the risk category or null if safe.
 */
export function detectContentRisk(
  title: string | null | undefined,
  streamerNiche?: string | null,
  streamerContentRisk?: string | null,
): ContentRisk | null {
  // Layer 1: Streamer-level risk (niche or auto-learned)
  if (streamerNiche && GAMBLING_NICHES.has(streamerNiche.toLowerCase())) {
    return 'gambling'
  }
  if (streamerContentRisk) {
    return streamerContentRisk as ContentRisk
  }

  // Layer 2: Title keyword matching
  if (!title) return null
  const t = title.trim()

  if (GAMBLING_RE.test(t)) return 'gambling'
  if (VIOLENCE_RE.test(t)) return 'violence'
  if (MATURE_RE.test(t)) return 'mature'

  return null
}

/**
 * Check if a streamer should be auto-flagged based on clip history.
 * If >= 60% of their last `windowSize` clips are flagged, returns the
 * dominant risk category.
 */
export function shouldFlagStreamer(
  recentClipRisks: (string | null)[],
  windowSize = 20,
): ContentRisk | null {
  const window = recentClipRisks.slice(0, windowSize)
  if (window.length < 5) return null // not enough data

  const counts: Record<string, number> = {}
  let flagged = 0
  for (const risk of window) {
    if (risk) {
      flagged++
      counts[risk] = (counts[risk] ?? 0) + 1
    }
  }

  if (flagged / window.length < 0.6) return null

  // Return the most common risk
  let maxRisk: ContentRisk = 'gambling'
  let maxCount = 0
  for (const [risk, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxRisk = risk as ContentRisk
    }
  }
  return maxRisk
}
