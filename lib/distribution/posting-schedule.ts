/**
 * Smart posting time recommendations per platform.
 *
 * Based on publicly available research on optimal posting times.
 * Hours are in UTC. The frontend should convert to the user's local timezone.
 */

export interface PostingSlot {
  platform: string
  hour: number // UTC
  quality: 'best' | 'good' | 'avoid'
  label: string
}

export interface TimingAdvice {
  good: boolean
  quality: 'best' | 'good' | 'avoid'
  suggestion: string
  nextBestIn: number | null // hours until next "best" slot, or null if now is best
}

const OPTIMAL_HOURS: Record<string, { best: number[]; good: number[]; avoid: number[] }> = {
  tiktok: {
    best: [7, 10, 19, 21],
    good: [8, 9, 11, 12, 18, 20, 22],
    avoid: [0, 1, 2, 3, 4, 5, 6, 14, 15, 16],
  },
  youtube: {
    best: [14, 15, 16, 17],
    good: [12, 13, 18, 19, 20],
    avoid: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  instagram: {
    best: [11, 12, 13, 19],
    good: [8, 9, 10, 14, 17, 18, 20],
    avoid: [0, 1, 2, 3, 4, 5, 22, 23],
  },
}

/**
 * Get the best posting time for a platform from the current moment.
 */
export function getBestPostingTime(platform: string): PostingSlot {
  const slots = OPTIMAL_HOURS[platform]
  if (!slots) return { platform, hour: 12, quality: 'good', label: 'Anytime' }

  const now = new Date()
  const currentHour = now.getUTCHours()

  // Find the next "best" hour
  const futureBest = slots.best.filter(h => h > currentHour)
  const nextBestHour = futureBest.length > 0 ? futureBest[0] : slots.best[0]

  return {
    platform,
    hour: nextBestHour,
    quality: 'best',
    label: 'Best time',
  }
}

/**
 * Get the full 24h schedule for a platform.
 */
export function getPostingSchedule(platform: string): PostingSlot[] {
  const slots = OPTIMAL_HOURS[platform]
  if (!slots) return []

  return Array.from({ length: 24 }, (_, hour) => {
    let quality: 'best' | 'good' | 'avoid' = 'good'
    let label = 'OK'

    if (slots.best.includes(hour)) {
      quality = 'best'
      label = 'Best time'
    } else if (slots.avoid.includes(hour)) {
      quality = 'avoid'
      label = 'Low engagement'
    } else if (slots.good.includes(hour)) {
      quality = 'good'
      label = 'Good time'
    }

    return { platform, hour, quality, label }
  })
}

/**
 * Check if right now is a good time to post on a platform.
 * Returns advice with a human-readable suggestion.
 */
export function isGoodTimeToPost(platform: string, hour?: number): TimingAdvice {
  const slots = OPTIMAL_HOURS[platform]
  if (!slots) {
    return { good: true, quality: 'good', suggestion: 'Good time to post', nextBestIn: null }
  }

  const currentHour = hour ?? new Date().getUTCHours()

  if (slots.best.includes(currentHour)) {
    return {
      good: true,
      quality: 'best',
      suggestion: 'Best time to post right now!',
      nextBestIn: null,
    }
  }

  // Find next best hour
  const futureBest = slots.best.filter(h => h > currentHour)
  const nextBest = futureBest.length > 0 ? futureBest[0] : slots.best[0] + 24
  const hoursUntil = nextBest - currentHour

  if (slots.good.includes(currentHour)) {
    return {
      good: true,
      quality: 'good',
      suggestion: `Good time to post. Best in ${hoursUntil}h`,
      nextBestIn: hoursUntil,
    }
  }

  if (slots.avoid.includes(currentHour)) {
    return {
      good: false,
      quality: 'avoid',
      suggestion: `Low engagement now. Best in ${hoursUntil}h`,
      nextBestIn: hoursUntil,
    }
  }

  return {
    good: true,
    quality: 'good',
    suggestion: `OK to post. Best in ${hoursUntil}h`,
    nextBestIn: hoursUntil,
  }
}
