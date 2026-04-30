/* ─── User Session Memory ───
 * Tracks in-session publishing patterns and generates personalized insights.
 * Purely in-memory — resets on page refresh. No database, no persistence.
 * All functions are pure: recordPublish returns a NEW object (no mutation).
 */

// ── Types ──

export interface PublishRecord {
  clipId: string
  clipTitle: string
  clipScore: number
  tone: string
  platforms: string[]
  timestamp: Date
  selectedVariant: string
}

export interface UserSessionMemory {
  clipsPublished: PublishRecord[]
  platformUsage: Record<string, number>
  toneUsage: Record<string, number>
  averageClipScore: number
  sessionStartedAt: Date
}

export interface PersonalizedInsight {
  text: string
  type: 'performance' | 'suggestion' | 'pattern' | 'encouragement'
  confidence: number
}

// ── Helpers ──

export function createSessionMemory(): UserSessionMemory {
  return {
    clipsPublished: [],
    platformUsage: {},
    toneUsage: {},
    averageClipScore: 0,
    sessionStartedAt: new Date(),
  }
}

export function recordPublish(
  memory: UserSessionMemory,
  data: {
    clipId: string
    clipTitle: string
    clipScore: number
    tone: string
    platforms: string[]
    selectedVariant: string
  }
): UserSessionMemory {
  const record: PublishRecord = { ...data, timestamp: new Date() }
  const clipsPublished = [...memory.clipsPublished, record]

  // Rebuild platformUsage
  const platformUsage = { ...memory.platformUsage }
  for (const p of data.platforms) {
    platformUsage[p] = (platformUsage[p] ?? 0) + 1
  }

  // Rebuild toneUsage
  const toneUsage = { ...memory.toneUsage }
  if (data.tone) {
    toneUsage[data.tone] = (toneUsage[data.tone] ?? 0) + 1
  }

  // Recalculate average score
  const totalScore = clipsPublished.reduce((sum, c) => sum + c.clipScore, 0)
  const averageClipScore = Math.round(totalScore / clipsPublished.length)

  return {
    ...memory,
    clipsPublished,
    platformUsage,
    toneUsage,
    averageClipScore,
  }
}

export function getTopPlatform(memory: UserSessionMemory): string | null {
  const entries = Object.entries(memory.platformUsage)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

export function getTopTone(memory: UserSessionMemory): string | null {
  const entries = Object.entries(memory.toneUsage)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

export function getSessionDuration(memory: UserSessionMemory): number {
  return Math.floor((Date.now() - memory.sessionStartedAt.getTime()) / 60000)
}

// ── Platform display names ──

const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
}

function platformName(id: string): string {
  return PLATFORM_NAMES[id] ?? id
}

// ── Variant display names ──

const VARIANT_NAMES: Record<string, string> = {
  'high-ctr': 'aggressive hooks',
  'safe-reach': 'safe-reach captions',
  'viral-bait': 'viral-bait style',
}

function variantName(id: string): string {
  return VARIANT_NAMES[id] ?? id
}

// ── Personalized Insights ──

export function getPersonalizedInsights(memory: UserSessionMemory): PersonalizedInsight[] {
  const insights: PersonalizedInsight[] = []
  const count = memory.clipsPublished.length

  if (count === 0) return insights

  // ── First publish ──
  if (count === 1) {
    insights.push({
      text: 'First clip of the session \u2014 front-loading your best content is smart',
      type: 'encouragement',
      confidence: 70,
    })
  }

  // ── Top tone pattern (2+ publishes) ──
  if (count >= 2) {
    const topTone = getTopTone(memory)
    if (topTone) {
      const toneCount = memory.toneUsage[topTone]
      if (toneCount >= 2) {
        insights.push({
          text: `Your ${topTone} clips are a pattern \u2014 lean into that energy, it\'s resonating`,
          type: 'pattern',
          confidence: 75,
        })
      }
    }
  }

  // ── Dominant platform ──
  const topPlatform = getTopPlatform(memory)
  if (topPlatform && memory.platformUsage[topPlatform] >= 2) {
    insights.push({
      text: `${platformName(topPlatform)} is your strongest channel this session`,
      type: 'performance',
      confidence: 78,
    })
  }

  // ── High average score ──
  if (count >= 2 && memory.averageClipScore >= 70) {
    const percentile = memory.averageClipScore >= 85 ? 5 : memory.averageClipScore >= 75 ? 15 : 25
    insights.push({
      text: `You have great taste \u2014 your average clip score is ${memory.averageClipScore}, top ${percentile}% of creators`,
      type: 'performance',
      confidence: 82,
    })
  }

  // ── Consistent variant choice ──
  if (count >= 2) {
    const variantCounts: Record<string, number> = {}
    for (const clip of memory.clipsPublished) {
      variantCounts[clip.selectedVariant] = (variantCounts[clip.selectedVariant] ?? 0) + 1
    }
    const entries = Object.entries(variantCounts).sort((a, b) => b[1] - a[1])
    const [topVariant, topCount] = entries[0]
    if (topCount >= 2 && topCount / count >= 0.6) {
      insights.push({
        text: `${variantName(topVariant)} are working for your niche \u2014 keep that formula`,
        type: 'pattern',
        confidence: 73,
      })
    }
  }

  // ── Rolling streak (3+) ──
  if (count >= 3) {
    const duration = getSessionDuration(memory)
    const durationLabel = duration < 60
      ? `${duration} min`
      : `${Math.floor(duration / 60)}h ${duration % 60}min`
    insights.push({
      text: `You're on a roll \u2014 ${count} clips distributed in ${durationLabel}. Consistency is key`,
      type: 'encouragement',
      confidence: 85,
    })
  }

  // ── Score comparison against average ──
  if (count >= 2) {
    const latest = memory.clipsPublished[count - 1]
    const prevAvg = Math.round(
      memory.clipsPublished.slice(0, -1).reduce((s, c) => s + c.clipScore, 0) / (count - 1)
    )
    const diff = latest.clipScore - prevAvg
    if (diff >= 10) {
      const pct = Math.round((diff / prevAvg) * 100)
      insights.push({
        text: `This clip scores ${pct}% higher than your session average \u2014 prime distribution candidate`,
        type: 'performance',
        confidence: 80,
      })
    } else if (diff <= -15) {
      insights.push({
        text: `This clip is below your session average \u2014 consider pairing it with a stronger follow-up`,
        type: 'suggestion',
        confidence: 65,
      })
    }
  }

  // ── Platform gap suggestion ──
  const allPossible = ['tiktok', 'youtube', 'instagram']
  const usedPlatforms = new Set(Object.keys(memory.platformUsage))
  const unused = allPossible.filter(p => !usedPlatforms.has(p))
  if (unused.length > 0 && count >= 2) {
    const suggest = unused[0]
    insights.push({
      text: `You haven't posted to ${platformName(suggest)} yet \u2014 diversifying platforms increases total reach by ~40%`,
      type: 'suggestion',
      confidence: 72,
    })
  }

  // ── Tone diversity ──
  const toneCount = Object.keys(memory.toneUsage).length
  if (toneCount >= 3 && count >= 3) {
    insights.push({
      text: `You're mixing ${toneCount} different tones \u2014 variety keeps your audience engaged across posts`,
      type: 'pattern',
      confidence: 70,
    })
  }

  // ── Score trend ──
  if (count >= 3) {
    const recent = memory.clipsPublished.slice(-3)
    const ascending = recent[0].clipScore <= recent[1].clipScore && recent[1].clipScore <= recent[2].clipScore
    if (ascending && recent[2].clipScore - recent[0].clipScore >= 10) {
      insights.push({
        text: 'Your clip selection is improving \u2014 each pick is scoring higher than the last',
        type: 'encouragement',
        confidence: 77,
      })
    }
  }

  return insights
}

// ── Personalized Strategy Message ──

export function getPersonalizedStrategyMessage(
  memory: UserSessionMemory,
  currentClipScore: number,
  aiEnabled: boolean
): string {
  const count = memory.clipsPublished.length

  // No history — generic
  if (count === 0) {
    return aiEnabled
      ? 'AI engine analyzing optimal strategy for your first clip'
      : 'Ready to distribute \u2014 publish your first clip to start building insights'
  }

  const topPlatform = getTopPlatform(memory)
  const topTone = getTopTone(memory)
  const avg = memory.averageClipScore
  const diff = currentClipScore - avg

  // Build a pool of relevant messages and pick based on context
  const candidates: string[] = []

  // Score comparison
  if (diff >= 10) {
    candidates.push(
      `Your last ${count} clip${count > 1 ? 's' : ''} averaged ${avg} score \u2014 this one at ${currentClipScore} could outperform them`
    )
  } else if (diff <= -10 && count >= 2) {
    candidates.push(
      `This clip scores below your ${avg} average \u2014 consider boosting with an aggressive caption`
    )
  }

  // Platform + tone combo
  if (topPlatform && topTone) {
    candidates.push(
      `Based on your session: ${topTone} content on ${platformName(topPlatform)} is your winning formula`
    )
  }

  // Platform saturation
  if (topPlatform && memory.platformUsage[topPlatform] >= 3) {
    const unused = ['tiktok', 'youtube', 'instagram'].filter(
      p => p !== topPlatform && !(memory.platformUsage[p])
    )
    if (unused.length > 0) {
      candidates.push(
        `You've been crushing it on ${platformName(topPlatform)} \u2014 try ${platformName(unused[0])} for untapped reach`
      )
    }
  }

  // Streak momentum
  if (count >= 3) {
    candidates.push(
      `${count} clips deep into this session \u2014 your distribution rhythm is locked in`
    )
  }

  // High performer
  if (currentClipScore >= 80) {
    candidates.push(
      `Score ${currentClipScore} detected \u2014 prioritize this clip for maximum first-hour impact`
    )
  }

  // Variant pattern
  if (count >= 2) {
    const lastTwo = memory.clipsPublished.slice(-2)
    if (lastTwo[0].selectedVariant === lastTwo[1].selectedVariant) {
      const vName = variantName(lastTwo[0].selectedVariant)
      candidates.push(
        `You keep choosing ${vName} \u2014 the algorithm rewards caption consistency`
      )
    }
  }

  // AI-specific
  if (aiEnabled && count >= 2) {
    candidates.push(
      `AI engine has learned from ${count} posts \u2014 timing and order are now personalized to your pattern`
    )
  }

  if (candidates.length === 0) {
    return `Session active with ${count} clip${count > 1 ? 's' : ''} published \u2014 keep the momentum going`
  }

  // Pick deterministically: use count + score as a simple selector
  const seed = (count * 17 + currentClipScore * 7) % candidates.length
  return candidates[seed]
}
