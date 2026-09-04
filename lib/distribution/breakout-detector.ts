/**
 * Mode 5x — Breakout Detection
 *
 * When refresh-post-stats detects a post performing > 3x the median
 * of the last 10 posts at 24h, triggers a "breakout" suggestion:
 * "This clip is breaking out — generate 3-5 variants?"
 *
 * For Studio plan: auto-enqueue variants (different hook, different trim).
 * For Free/Pro: notification only, manual action.
 */

export interface BreakoutCandidate {
  postId: string
  clipId: string
  clipSourceId: string
  platform: string
  views: number
  median: number
  ratio: number          // views / median
  suggestedVariants: number  // 3-5 based on ratio
  detectedAt: string
}

/**
 * Check if a post qualifies as a breakout (> 3x median of last 10 posts).
 */
export function detectBreakout(
  postViews: number,
  recentPostViews: number[],
): { isBreakout: boolean; ratio: number; median: number; suggestedVariants: number } {
  if (recentPostViews.length < 3) {
    return { isBreakout: false, ratio: 0, median: 0, suggestedVariants: 0 }
  }

  // Calculate median of last 10 posts
  const sorted = [...recentPostViews].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]

  if (median <= 0) {
    return { isBreakout: false, ratio: 0, median: 0, suggestedVariants: 0 }
  }

  const ratio = postViews / median

  if (ratio < 3) {
    return { isBreakout: false, ratio, median, suggestedVariants: 0 }
  }

  // Suggest variants based on how strong the breakout is
  // 3-5x → 3 variants, 5-10x → 4 variants, 10x+ → 5 variants
  const suggestedVariants = ratio >= 10 ? 5 : ratio >= 5 ? 4 : 3

  return { isBreakout: true, ratio, median, suggestedVariants }
}

/**
 * Build the suggestion message for the breakout notification.
 */
export function buildBreakoutMessage(
  ratio: number,
  variants: number,
  platform: string,
): string {
  const mult = `${Math.round(ratio)}x`
  return `This clip is performing ${mult} above your median on ${platform} — generate ${variants} variants to capitalize in the next 24h?`
}
