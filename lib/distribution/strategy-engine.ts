/* ─── Strategy Engine ───
 * Generates dynamic, context-aware distribution strategy data.
 * All functions are pure (no side effects, no API calls).
 * Deterministic per session via day+hour+clipId seeding.
 */

// ── Seed utility ──

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function pickFromPool<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length]
}

// ── Types ──

export interface FrequencyRecommendation {
  label: string
  reasoning: string
  confidencePercent: number
}

export interface PriorityRecommendation {
  label: string
  order: string[]
  reasoning: string
}

export interface ConfidenceResult {
  level: 'high' | 'medium' | 'low'
  percent: number
  label: string
}

// ── Time helpers ──

type TimeSlot = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'late_night'

function getTimeSlot(hour: number): TimeSlot {
  if (hour < 7) return 'early_morning'
  if (hour < 11) return 'morning'
  if (hour < 14) return 'midday'
  if (hour < 18) return 'afternoon'
  if (hour < 23) return 'evening'
  return 'late_night'
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6
}

// ── 1. Post Frequency ──

export function getPostFrequency(params: {
  clipScore: number
  dayOfWeek: number
  hourOfDay: number
  activePlatformCount: number
  clipId: string
}): FrequencyRecommendation {
  const { clipScore, dayOfWeek, hourOfDay, activePlatformCount, clipId } = params
  const slot = getTimeSlot(hourOfDay)
  const weekend = isWeekend(dayOfWeek)
  const seed = hashSeed(`${clipId}-${dayOfWeek}-${hourOfDay}`)

  // Score tier determines base aggressiveness
  const isViral = clipScore >= 80
  const isHot = clipScore >= 60
  const isDecent = clipScore >= 40

  // Platform modifier: 3 platforms = slightly slower cadence per platform
  const platformTag = activePlatformCount >= 3 ? 'multi' : activePlatformCount === 2 ? 'dual' : 'single'

  // Build candidate pools based on context
  type Candidate = { label: string; reasoning: string; confidence: number }

  const candidates: Candidate[] = []

  // ── Viral clip patterns ──
  if (isViral) {
    if (slot === 'evening') {
      candidates.push(
        { label: 'Now + 6h + tomorrow 11 AM', reasoning: 'Viral window detected — triple-post cadence for maximum first-day reach', confidence: 92 },
        { label: '3x today, 2x tomorrow', reasoning: 'High-score clip in prime time — aggressive front-loading recommended', confidence: 90 },
        { label: 'Every 3-4h (viral window)', reasoning: 'Peak engagement hours active — rapid cadence to ride the algorithm wave', confidence: 88 },
      )
    } else if (slot === 'morning') {
      candidates.push(
        { label: 'Now + 2 PM + 8 PM', reasoning: 'Morning post anchors the day — follow up at lunch and evening peaks', confidence: 91 },
        { label: '3x spread across day', reasoning: 'Full-day coverage with a viral clip — catch every audience wave', confidence: 89 },
        { label: 'Every 4h starting now', reasoning: 'High potential clip — sustained exposure throughout the day', confidence: 87 },
      )
    } else if (slot === 'midday') {
      candidates.push(
        { label: 'Now + 6 PM + 10 PM', reasoning: 'Lunch post seeds engagement — double down during evening peak', confidence: 90 },
        { label: '3x today (lunch → evening)', reasoning: 'Midday launch with evening follow-ups for maximum daily reach', confidence: 88 },
      )
    } else if (slot === 'afternoon') {
      candidates.push(
        { label: 'Now + 9 PM + tomorrow 11 AM', reasoning: 'Afternoon start with evening push — carry momentum into tomorrow', confidence: 89 },
        { label: '2x today + 2x tomorrow morning', reasoning: 'Straddle two peak windows for sustained viral momentum', confidence: 87 },
      )
    } else {
      // early_morning or late_night
      candidates.push(
        { label: '8 AM + 1 PM + 7 PM', reasoning: 'Schedule for today\'s three peak windows — clip is too strong to post off-hours', confidence: 86 },
        { label: '3x tomorrow (peak hours)', reasoning: 'Delay to peak hours — viral clips deserve maximum-audience windows', confidence: 84 },
      )
    }

    if (weekend) {
      candidates.push(
        { label: 'Every 3h (weekend surge)', reasoning: 'Weekend audience is online longer — higher frequency pays off', confidence: 91 },
      )
    }
  }

  // ── Hot clip patterns ──
  if (isHot && !isViral) {
    if (slot === 'evening') {
      candidates.push(
        { label: '2x today (evening prime time)', reasoning: 'Evening audience is active — post now and follow up in 4h', confidence: 82 },
        { label: 'Now + tomorrow 12 PM', reasoning: 'Evening post + next-day lunch follow-up for two-wave coverage', confidence: 80 },
        { label: 'Every 5-6h', reasoning: 'Solid clip in prime time — steady cadence without over-saturating', confidence: 78 },
      )
    } else if (slot === 'morning' || slot === 'midday') {
      candidates.push(
        { label: '2x today, 1x tomorrow', reasoning: 'Spread across day peaks — build gradual traction', confidence: 81 },
        { label: 'Now + 7 PM tonight', reasoning: 'Anchor with a morning post, reinforce during evening peak', confidence: 79 },
        { label: 'Every 5h starting now', reasoning: 'Consistent cadence through the day for steady algorithm signals', confidence: 77 },
      )
    } else {
      candidates.push(
        { label: '2x tomorrow (optimized times)', reasoning: 'Off-peak hours now — schedule for tomorrow\'s high-traffic windows', confidence: 76 },
        { label: 'Tomorrow 10 AM + 7 PM', reasoning: 'Two strategic posts at the next available peak windows', confidence: 74 },
      )
    }

    if (weekend) {
      candidates.push(
        { label: '2x today + 1x Monday morning', reasoning: 'Maximize weekend reach, then catch Monday commute audience', confidence: 80 },
      )
    }
  }

  // ── Decent clip patterns ──
  if (isDecent && !isHot) {
    candidates.push(
      { label: 'Every 8h', reasoning: 'Moderate-score clip — consistent cadence without overexposure', confidence: 68 },
      { label: '1x today + 1x tomorrow', reasoning: 'Two-post strategy — test engagement before committing more', confidence: 66 },
    )
    if (slot === 'evening') {
      candidates.push(
        { label: 'Now + tomorrow afternoon', reasoning: 'Post during tonight\'s peak, then reassess with a follow-up tomorrow', confidence: 70 },
      )
    } else {
      candidates.push(
        { label: 'Today 7 PM (single shot)', reasoning: 'Wait for evening peak — one well-timed post outperforms multiple off-peak', confidence: 67 },
      )
    }
  }

  // ── Low score fallback ──
  if (!isDecent) {
    candidates.push(
      { label: '1x today (test post)', reasoning: 'Low confidence clip — single post to gauge audience response', confidence: 55 },
      { label: 'Every 12h', reasoning: 'Conservative cadence — let the algorithm decide before posting more', confidence: 52 },
      { label: 'Once, then evaluate', reasoning: 'Post once and monitor performance before committing further', confidence: 50 },
    )
  }

  // Multi-platform modifier: add a stagger variant
  if (platformTag === 'multi' && candidates.length > 0) {
    candidates.push({
      label: candidates[0].label + ' (staggered)',
      reasoning: `${activePlatformCount} platforms active — offset posts by 30 min per platform for unique reach`,
      confidence: Math.min(candidates[0].confidence + 2, 95),
    })
  }

  // Pick deterministically from candidates
  const pick = pickFromPool(candidates, seed)

  return {
    label: pick.label,
    reasoning: pick.reasoning,
    confidencePercent: pick.confidence,
  }
}

// ── 2. Platform Priority ──

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
}

function shortLabel(platformId: string): string {
  if (platformId === 'youtube') return 'YouTube'
  if (platformId === 'instagram') return 'Instagram'
  return PLATFORM_LABELS[platformId] ?? platformId
}

export function getPlatformPriority(params: {
  enabledPlatforms: string[]
  clipScore: number
  hourOfDay: number
  dayOfWeek: number
}): PriorityRecommendation {
  const { enabledPlatforms, clipScore, hourOfDay, dayOfWeek } = params

  if (enabledPlatforms.length === 0) {
    return { label: 'No platforms active', order: [], reasoning: 'Enable at least one platform to see priority recommendations' }
  }

  if (enabledPlatforms.length === 1) {
    const p = enabledPlatforms[0]
    return { label: `${shortLabel(p)} only`, order: [p], reasoning: 'Single platform active — connect more for cross-platform strategy' }
  }

  const slot = getTimeSlot(hourOfDay)
  const weekend = isWeekend(dayOfWeek)
  const has = (id: string) => enabledPlatforms.includes(id)

  // Determine primary platform by time of day
  let primary: string
  let reasoning: string

  if (slot === 'evening' || slot === 'late_night') {
    primary = has('tiktok') ? 'tiktok' : enabledPlatforms[0]
    reasoning = 'Evening peak — TikTok audience is most active'
  } else if (slot === 'midday') {
    primary = has('youtube') ? 'youtube' : enabledPlatforms[0]
    reasoning = 'Midday browsing window — YouTube Shorts catches lunch-break viewers'
  } else if (slot === 'morning' || slot === 'early_morning') {
    primary = has('instagram') ? 'instagram' : enabledPlatforms[0]
    reasoning = 'Morning scroll — Instagram Reels dominates the wake-up feed'
  } else {
    // afternoon: TikTok or YouTube
    if (weekend) {
      primary = has('tiktok') ? 'tiktok' : enabledPlatforms[0]
      reasoning = 'Weekend afternoon — TikTok engagement surges with leisure browsing'
    } else {
      primary = has('youtube') ? 'youtube' : enabledPlatforms[0]
      reasoning = 'Weekday afternoon — YouTube Shorts captures work-break audience'
    }
  }

  // Build order: primary first, then remaining sorted by time-relevance
  const remaining = enabledPlatforms.filter(p => p !== primary)

  // Secondary sort: for remaining platforms, prefer TikTok > YouTube > Instagram as general fallback
  const secondaryOrder: Record<string, number> = { tiktok: 0, youtube: 1, instagram: 2 }
  remaining.sort((a, b) => (secondaryOrder[a] ?? 9) - (secondaryOrder[b] ?? 9))

  const order = [primary, ...remaining]

  // Build stagger label
  const staggerHours = clipScore >= 70 ? 2 : 3
  let label: string

  if (order.length === 2) {
    label = `${shortLabel(order[0])} first \u2192 ${shortLabel(order[1])} ${staggerHours}h later`
  } else if (order.length === 3) {
    label = `${shortLabel(order[0])} first \u2192 ${shortLabel(order[1])} ${staggerHours}h later \u2192 ${shortLabel(order[2])} tomorrow AM`
  } else {
    label = order.map(p => shortLabel(p)).join(' \u2192 ')
  }

  return { label, order, reasoning }
}

// ── 3. Strategy Message ──

interface MessageCandidate {
  text: string
  match: (ctx: MessageContext) => boolean
}

interface MessageContext {
  clipScore: number
  aiEnabled: boolean
  activePlatformCount: number
  hourOfDay: number
  dayOfWeek: number
  hasPublishedBefore: boolean
  slot: TimeSlot
  weekend: boolean
}

const MESSAGE_POOL: MessageCandidate[] = [
  // Time-based
  { text: 'Evening prime time active \u2014 TikTok audience peaks now', match: (c) => c.slot === 'evening' },
  { text: 'Morning scroll window open \u2014 Instagram engagement is highest right now', match: (c) => c.slot === 'morning' },
  { text: 'Lunch break browsing spike \u2014 YouTube Shorts performs best at midday', match: (c) => c.slot === 'midday' },
  { text: 'Late-night audience active \u2014 lower competition, higher per-view engagement', match: (c) => c.slot === 'late_night' },
  { text: 'Afternoon lull \u2014 schedule for the next peak window instead of posting now', match: (c) => c.slot === 'afternoon' && c.clipScore < 70 },
  { text: 'Afternoon + high-score clip \u2014 post now to build momentum before the evening surge', match: (c) => c.slot === 'afternoon' && c.clipScore >= 70 },

  // Weekend-specific
  { text: 'Weekend audience online \u2014 maximize exposure with staggered posts', match: (c) => c.weekend },
  { text: 'Saturday engagement boost \u2014 casual viewers scroll 40% longer on weekends', match: (c) => c.dayOfWeek === 6 },
  { text: 'Sunday wind-down \u2014 longer watch times mean better retention metrics', match: (c) => c.dayOfWeek === 0 },

  // Day-specific
  { text: 'Tuesday evening = high engagement historically \u2014 push now', match: (c) => c.dayOfWeek === 2 && c.slot === 'evening' },
  { text: 'Wednesday midweek peak \u2014 audience craves fresh content by mid-week', match: (c) => c.dayOfWeek === 3 },
  { text: 'Thursday pre-weekend buzz \u2014 clips posted today carry into weekend discovery', match: (c) => c.dayOfWeek === 4 },
  { text: 'Monday fresh start \u2014 algorithms favor new content at the top of the week', match: (c) => c.dayOfWeek === 1 },
  { text: 'Friday evening \u2014 leisure mode activated, entertainment content peaks', match: (c) => c.dayOfWeek === 5 && c.slot === 'evening' },

  // Score-based
  { text: 'Peak engagement window detected \u2014 aggressive posting recommended', match: (c) => c.clipScore >= 80 },
  { text: 'Viral-tier clip loaded \u2014 front-load distribution for maximum first-hour impact', match: (c) => c.clipScore >= 85 },
  { text: 'Solid clip score \u2014 consistent posting will build steady traction', match: (c) => c.clipScore >= 50 && c.clipScore < 70 },

  // AI-specific
  { text: 'AI engine active \u2014 timing, captions, and platform order auto-optimized', match: (c) => c.aiEnabled },
  { text: 'Multi-platform strategy active \u2014 staggered posting for maximum unique reach', match: (c) => c.activePlatformCount >= 2 },

  // First-time
  { text: 'First post of the session \u2014 front-load your best clip', match: (c) => !c.hasPublishedBefore },
]

export function getStrategyMessage(params: {
  clipScore: number
  aiEnabled: boolean
  activePlatformCount: number
  hourOfDay: number
  dayOfWeek: number
  hasPublishedBefore: boolean
}): string {
  const ctx: MessageContext = {
    ...params,
    slot: getTimeSlot(params.hourOfDay),
    weekend: isWeekend(params.dayOfWeek),
  }

  // Filter to matching messages
  const matching = MESSAGE_POOL.filter(m => m.match(ctx))
  if (matching.length === 0) {
    return 'Distribution ready \u2014 select a clip and hit publish'
  }

  // Seed from day + hour so consecutive refreshes within the same hour are stable,
  // but different hours/days pick different messages
  const seed = hashSeed(`strategy-${params.dayOfWeek}-${params.hourOfDay}`)
  return pickFromPool(matching, seed).text
}

// ── 4. Confidence Level ──

export function getConfidenceLevel(params: {
  clipScore: number
  platformCount: number
  hasCaption: boolean
}): ConfidenceResult {
  const { clipScore, platformCount, hasCaption } = params

  // Calculate raw score
  let raw = 40 // base

  // Clip score contribution (0-30 points)
  if (clipScore >= 80) raw += 30
  else if (clipScore >= 70) raw += 25
  else if (clipScore >= 60) raw += 20
  else if (clipScore >= 50) raw += 15
  else if (clipScore >= 40) raw += 10
  else raw += 5

  // Platform contribution (0-15 points)
  if (platformCount >= 3) raw += 15
  else if (platformCount >= 2) raw += 10
  else if (platformCount >= 1) raw += 5

  // Caption contribution (0-10 points)
  if (hasCaption) raw += 10

  // Clamp to 40-95
  const percent = Math.max(40, Math.min(95, raw))

  if (percent >= 80) {
    return { level: 'high', percent, label: 'High confidence' }
  }
  if (percent >= 60) {
    return { level: 'medium', percent, label: 'Moderate confidence' }
  }
  return { level: 'low', percent, label: 'Low confidence' }
}
