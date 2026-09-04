/**
 * Cadence Engine — controls posting frequency, warm-up, and spacing.
 *
 * 3 presets:
 *   - warm-up: account connected < 7 days → 0 posts first 48h, then 1/day for 7 days
 *   - growth:  1-2 posts/day
 *   - farm:    3-4 posts/day
 *
 * Hard limits:
 *   - Never > 4 posts/day per account
 *   - Minimum 3h between posts on the same account
 *   - Never the same clip source on two accounts the same day
 *   - Never two variants of the same source clip < 24h apart on one account
 */

export type CadencePreset = 'warm-up' | 'growth' | 'farm'

export interface CadenceConfig {
  preset: CadencePreset
  maxPostsPerDay: number
  minHoursBetweenPosts: number
  /** Default posting window: [startHour, endHour] in audience local time */
  postingWindow: [number, number]
  /** Override posting window from analytics (Etage 4 hook) */
  analyticsWindowOverride?: [number, number] | null
}

export interface AccountAge {
  connectedAt: string   // ISO date of first OAuth connection
  postCount: number     // total published posts for this account
}

const ABSOLUTE_MAX_POSTS_PER_DAY = 4
const ABSOLUTE_MIN_HOURS_BETWEEN = 3

/**
 * Detect the right cadence preset based on account age.
 */
export function detectCadencePreset(account: AccountAge): CadencePreset {
  const connectedMs = Date.now() - new Date(account.connectedAt).getTime()
  const connectedDays = connectedMs / (1000 * 60 * 60 * 24)

  // New account: < 7 days connected
  if (connectedDays < 7) return 'warm-up'

  // Established account with low history: growth
  if (account.postCount < 30) return 'growth'

  // High-volume established account: farm
  return 'farm'
}

/**
 * Build cadence config for a preset.
 */
export function buildCadenceConfig(
  preset: CadencePreset,
  overrides?: Partial<CadenceConfig>,
): CadenceConfig {
  const base: CadenceConfig = {
    preset,
    maxPostsPerDay: preset === 'warm-up' ? 1 : preset === 'growth' ? 2 : 4,
    minHoursBetweenPosts: ABSOLUTE_MIN_HOURS_BETWEEN,
    postingWindow: [18, 22], // default 18h-22h local
    analyticsWindowOverride: null,
  }

  return { ...base, ...overrides }
}

/**
 * Get the effective posting window (analytics override wins if available).
 */
export function getEffectiveWindow(config: CadenceConfig): [number, number] {
  return config.analyticsWindowOverride ?? config.postingWindow
}

/**
 * Check if we're in the warm-up blackout period (first 48h after connection).
 */
export function isWarmupBlackout(connectedAt: string): boolean {
  const connectedMs = Date.now() - new Date(connectedAt).getTime()
  const hours = connectedMs / (1000 * 60 * 60)
  return hours < 48
}

/**
 * How many posts are allowed today given cadence + warm-up state.
 */
export function getAllowedPostsToday(
  config: CadenceConfig,
  connectedAt: string,
  postsToday: number,
): { allowed: number; reason: string | null } {
  // Warm-up blackout: 0 posts first 48h
  if (config.preset === 'warm-up' && isWarmupBlackout(connectedAt)) {
    return { allowed: 0, reason: 'Warm-up: first 48h cooldown, no posts yet' }
  }

  const max = Math.min(config.maxPostsPerDay, ABSOLUTE_MAX_POSTS_PER_DAY)
  const remaining = Math.max(0, max - postsToday)

  if (remaining === 0) {
    return { allowed: 0, reason: `Daily limit reached (${max}/day on ${config.preset} cadence)` }
  }

  return { allowed: remaining, reason: null }
}

/**
 * Check spacing constraint: minimum 3h since last post on same account.
 */
export function checkSpacing(
  lastPostAt: string | null,
  minHours: number = ABSOLUTE_MIN_HOURS_BETWEEN,
): { canPost: boolean; waitMinutes: number; reason: string | null } {
  if (!lastPostAt) return { canPost: true, waitMinutes: 0, reason: null }

  const elapsedMs = Date.now() - new Date(lastPostAt).getTime()
  const elapsedHours = elapsedMs / (1000 * 60 * 60)

  if (elapsedHours >= minHours) {
    return { canPost: true, waitMinutes: 0, reason: null }
  }

  const waitMinutes = Math.ceil((minHours - elapsedHours) * 60)
  return {
    canPost: false,
    waitMinutes,
    reason: `Spacing: ${waitMinutes}min until next post (${minHours}h minimum)`,
  }
}

/**
 * Check duplicate constraints:
 * - Never the same clip source on two accounts the same day
 * - Never two variants of the same source clip < 24h apart on one account
 */
export function checkDuplicateConstraints(
  clipSourceId: string,
  accountId: string,
  recentPosts: Array<{
    clip_source_id: string
    account_id: string
    published_at: string
  }>,
): { allowed: boolean; reason: string | null } {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  for (const post of recentPosts) {
    const postDate = new Date(post.published_at)

    // Same source on different account same day
    if (
      post.clip_source_id === clipSourceId &&
      post.account_id !== accountId &&
      postDate >= todayStart
    ) {
      return { allowed: false, reason: 'Same clip source already posted on another account today' }
    }

    // Same source on same account within 24h
    if (
      post.clip_source_id === clipSourceId &&
      post.account_id === accountId
    ) {
      const hoursSince = (Date.now() - postDate.getTime()) / (1000 * 60 * 60)
      if (hoursSince < 24) {
        return { allowed: false, reason: 'Same clip source posted on this account < 24h ago' }
      }
    }
  }

  return { allowed: true, reason: null }
}

/**
 * Cadence summary for UI display.
 */
export function getCadenceSummary(
  config: CadenceConfig,
  connectedAt: string,
  postsToday: number,
  lastPostAt: string | null,
): {
  preset: CadencePreset
  presetLabel: string
  postsToday: number
  maxToday: number
  nextSlotIn: string | null
  gateRefusals: string[]
} {
  const { allowed, reason: dailyReason } = getAllowedPostsToday(config, connectedAt, postsToday)
  const { canPost, waitMinutes, reason: spacingReason } = checkSpacing(lastPostAt, config.minHoursBetweenPosts)

  const presetLabels: Record<CadencePreset, string> = {
    'warm-up': 'Warm-up',
    'growth': 'Growth (1-2/day)',
    'farm': 'Farm (3-4/day)',
  }

  const refusals: string[] = []
  if (dailyReason) refusals.push(dailyReason)
  if (spacingReason) refusals.push(spacingReason)

  let nextSlotIn: string | null = null
  if (!canPost && waitMinutes > 0) {
    nextSlotIn = waitMinutes >= 60
      ? `${Math.floor(waitMinutes / 60)}h${waitMinutes % 60 > 0 ? `${waitMinutes % 60}m` : ''}`
      : `${waitMinutes}m`
  }

  return {
    preset: config.preset,
    presetLabel: presetLabels[config.preset],
    postsToday,
    maxToday: Math.min(config.maxPostsPerDay, ABSOLUTE_MAX_POSTS_PER_DAY),
    nextSlotIn,
    gateRefusals: refusals,
  }
}
