/**
 * Keyword pre-score — CHEAP, FAST, no AI.
 * Scans bio + recent post titles for affiliate signals.
 */
export function keywordAffiliateScore(profile: {
  bio?: string
  recentPostTitles?: string[]
  linksCount?: number
  links?: string[]
  hasEmail?: boolean
}): { score: number; strongSignals: string[]; mediumSignals: string[] } {
  let score = 0
  const strongSignals: string[] = []
  const mediumSignals: string[] = []

  const text = [
    profile.bio ?? '',
    ...(profile.recentPostTitles ?? []),
  ].join(' ').toLowerCase()

  // Strong signals (+15 each, max 60)
  const strong = ['use code', 'promo code', 'affiliate', 'partner', 'sponsored', '#ad']
  for (const kw of strong) {
    if (text.includes(kw)) {
      score += 15
      strongSignals.push(kw)
    }
  }

  // Medium signals (+10 each)
  const medium = ['link in bio', 'tools i use', 'apps i love', 'discount', 'collab', 'review']
  for (const kw of medium) {
    if (text.includes(kw)) {
      score += 10
      mediumSignals.push(kw)
    }
  }

  // Multi-monetization (+15)
  if ((profile.linksCount ?? 0) >= 3) {
    score += 15
    mediumSignals.push('3+ links')
  }

  // Linktree/Beacons/Stan (+10)
  if (profile.links?.some(l => /linktr\.ee|beacons\.ai|stan\.store|carrd\.co/i.test(l))) {
    score += 10
    mediumSignals.push('linktree/beacons')
  }

  // Email contactability boost (+20)
  if (profile.hasEmail) {
    score += 20
    strongSignals.push('has email')
  }

  return { score: Math.min(score, 100), strongSignals, mediumSignals }
}
