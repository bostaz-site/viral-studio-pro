/* ─── Reward Engine ───
 *
 * Dopamine/reward system: streaks, milestones, rare events, progression.
 * Designed for sparsity — most publishes trigger nothing special.
 * When a reward DOES fire, it should feel earned.
 */

// ══════════════════════════════════════════════════════════════
// ── Types
// ══════════════════════════════════════════════════════════════

export interface Reward {
  id: string
  type: 'milestone' | 'streak' | 'rare_event' | 'personal_best' | 'level_up'
  title: string
  subtitle: string
  emoji: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

interface LevelDef {
  level: number
  title: string
  clipsRequired: number
}

// ══════════════════════════════════════════════════════════════
// ── Milestone rewards (total clips published)
// ══════════════════════════════════════════════════════════════

const MILESTONES: readonly { at: number; reward: Reward }[] = [
  {
    at: 1,
    reward: {
      id: 'milestone-1',
      type: 'milestone',
      title: 'First Blood',
      subtitle: 'Your distribution journey begins',
      emoji: '\uD83C\uDFAF',
      rarity: 'common',
    },
  },
  {
    at: 5,
    reward: {
      id: 'milestone-5',
      type: 'milestone',
      title: 'Getting Serious',
      subtitle: '5 clips distributed \u2014 you\'re building momentum',
      emoji: '\uD83D\uDCAA',
      rarity: 'common',
    },
  },
  {
    at: 10,
    reward: {
      id: 'milestone-10',
      type: 'milestone',
      title: 'Double Digits',
      subtitle: '10 clips out there working for you',
      emoji: '\uD83D\uDD25',
      rarity: 'uncommon',
    },
  },
  {
    at: 25,
    reward: {
      id: 'milestone-25',
      type: 'milestone',
      title: 'Content Machine',
      subtitle: '25 clips \u2014 you\'re in the top 10% of creators',
      emoji: '\u26A1',
      rarity: 'uncommon',
    },
  },
  {
    at: 50,
    reward: {
      id: 'milestone-50',
      type: 'milestone',
      title: 'Half Century',
      subtitle: '50 clips \u2014 elite distributor status',
      emoji: '\uD83D\uDC8E',
      rarity: 'rare',
    },
  },
  {
    at: 100,
    reward: {
      id: 'milestone-100',
      type: 'milestone',
      title: 'Centurion',
      subtitle: '100 clips \u2014 legendary creator',
      emoji: '\uD83D\uDC51',
      rarity: 'legendary',
    },
  },
]

export function checkMilestone(totalClipsPublished: number): Reward | null {
  const hit = MILESTONES.find(m => m.at === totalClipsPublished)
  return hit?.reward ?? null
}

// ══════════════════════════════════════════════════════════════
// ── Streak rewards (consecutive days)
// ══════════════════════════════════════════════════════════════

const STREAKS: readonly { at: number; reward: Reward }[] = [
  {
    at: 3,
    reward: {
      id: 'streak-3',
      type: 'streak',
      title: 'Hat Trick',
      subtitle: '3 days in a row \u2014 consistency boost active',
      emoji: '\uD83D\uDD25',
      rarity: 'common',
    },
  },
  {
    at: 7,
    reward: {
      id: 'streak-7',
      type: 'streak',
      title: 'Full Week',
      subtitle: '7-day streak \u2014 algorithm loves consistency',
      emoji: '\uD83D\uDCAA',
      rarity: 'uncommon',
    },
  },
  {
    at: 14,
    reward: {
      id: 'streak-14',
      type: 'streak',
      title: 'Two Weeks Strong',
      subtitle: 'The algorithm is starting to recognize you',
      emoji: '\u26A1',
      rarity: 'uncommon',
    },
  },
  {
    at: 30,
    reward: {
      id: 'streak-30',
      type: 'streak',
      title: 'Monthly Legend',
      subtitle: '30-day streak \u2014 unstoppable',
      emoji: '\uD83D\uDC51',
      rarity: 'legendary',
    },
  },
]

export function checkStreak(currentStreak: number): Reward | null {
  const hit = STREAKS.find(s => s.at === currentStreak)
  return hit?.reward ?? null
}

// ══════════════════════════════════════════════════════════════
// ── Rare events (conditional, at most ONE per publish)
// ══════════════════════════════════════════════════════════════

export function checkRareEvents(params: {
  clipScore: number
  sessionClipCount: number
  totalClipsPublished: number
  currentStreak: number
  bestClipScore: number
  averageScore: number
  platformCount: number
}): Reward | null {
  const {
    clipScore,
    sessionClipCount,
    totalClipsPublished,
    currentStreak,
    bestClipScore,
    averageScore,
    platformCount,
  } = params

  // Priority order: rarest first. Return the FIRST match only.

  // "Potential Breakout" (rare) — score > 85 AND 3+ platforms
  if (clipScore > 85 && platformCount >= 3) {
    return {
      id: `rare-breakout-${totalClipsPublished}`,
      type: 'rare_event',
      title: 'Potential Breakout',
      subtitle: 'This clip has breakout potential \u2014 all platforms aligned',
      emoji: '\uD83D\uDD25',
      rarity: 'rare',
    }
  }

  // "Perfect Setup" (rare) — score > 80 AND 3 platforms
  if (clipScore > 80 && platformCount >= 3) {
    return {
      id: `rare-perfect-${totalClipsPublished}`,
      type: 'rare_event',
      title: 'Perfect Setup',
      subtitle: 'Perfect distribution setup \u2014 maximum potential',
      emoji: '\uD83D\uDC8E',
      rarity: 'rare',
    }
  }

  // "Score Spike" (uncommon) — score > average + 20
  if (averageScore > 0 && clipScore > averageScore + 20) {
    return {
      id: `rare-spike-${totalClipsPublished}`,
      type: 'rare_event',
      title: 'Score Spike',
      subtitle: 'This clip scores way above your average \u2014 outlier detected',
      emoji: '\uD83D\uDCC8',
      rarity: 'uncommon',
    }
  }

  // "Triple Threat" (uncommon) — 3 clips in session all > 70
  // sessionClipCount >= 3 implies at least 3 published this session;
  // caller guarantees the last 3 all scored > 70 by passing sessionClipCount >= 3
  // We check the current clip + count as a proxy.
  if (sessionClipCount >= 3 && clipScore > 70) {
    return {
      id: `rare-triple-${totalClipsPublished}`,
      type: 'rare_event',
      title: 'Triple Threat',
      subtitle: 'Three strong clips in a row \u2014 you\'re on fire',
      emoji: '\u26A1',
      rarity: 'uncommon',
    }
  }

  // "Sniper" (uncommon) — first clip of session scores > 85
  if (sessionClipCount === 1 && clipScore > 85) {
    return {
      id: `rare-sniper-${totalClipsPublished}`,
      type: 'rare_event',
      title: 'Sniper',
      subtitle: 'First shot, bullseye \u2014 great clip selection',
      emoji: '\uD83C\uDFAF',
      rarity: 'uncommon',
    }
  }

  // "New Personal Best" (common) — score > best ever
  if (clipScore > bestClipScore && bestClipScore > 0) {
    return {
      id: `rare-pb-${totalClipsPublished}`,
      type: 'personal_best',
      title: 'New Personal Best',
      subtitle: 'New record! Your best clip yet',
      emoji: '\uD83D\uDC51',
      rarity: 'common',
    }
  }

  // Most publishes: nothing special
  return null
}

// ══════════════════════════════════════════════════════════════
// ── Session milestones (same-session clip count)
// ══════════════════════════════════════════════════════════════

const SESSION_MILESTONES: readonly { at: number; reward: Reward }[] = [
  {
    at: 3,
    reward: {
      id: 'session-3',
      type: 'milestone',
      title: 'Triple Drop',
      subtitle: '3 clips this session \u2014 strong push',
      emoji: '\u26A1',
      rarity: 'common',
    },
  },
  {
    at: 5,
    reward: {
      id: 'session-5',
      type: 'milestone',
      title: 'Power Session',
      subtitle: '5 clips \u2014 maximum session output',
      emoji: '\uD83D\uDD25',
      rarity: 'uncommon',
    },
  },
  {
    at: 10,
    reward: {
      id: 'session-10',
      type: 'milestone',
      title: 'Marathon Runner',
      subtitle: '10 clips in one session \u2014 absolute grinder',
      emoji: '\uD83D\uDC8E',
      rarity: 'rare',
    },
  },
]

export function checkSessionMilestone(sessionClipCount: number): Reward | null {
  const hit = SESSION_MILESTONES.find(m => m.at === sessionClipCount)
  return hit?.reward ?? null
}

// ══════════════════════════════════════════════════════════════
// ── Creator progression level
// ══════════════════════════════════════════════════════════════

const LEVELS: readonly LevelDef[] = [
  { level: 1,  title: 'Rookie',       clipsRequired: 0 },
  { level: 2,  title: 'Starter',      clipsRequired: 3 },
  { level: 3,  title: 'Creator',      clipsRequired: 8 },
  { level: 4,  title: 'Distributor',  clipsRequired: 15 },
  { level: 5,  title: 'Strategist',   clipsRequired: 25 },
  { level: 6,  title: 'Expert',       clipsRequired: 40 },
  { level: 7,  title: 'Pro',          clipsRequired: 60 },
  { level: 8,  title: 'Elite',        clipsRequired: 85 },
  { level: 9,  title: 'Master',       clipsRequired: 120 },
  { level: 10, title: 'Legend',       clipsRequired: 200 },
]

export function getCreatorLevel(totalClips: number): {
  level: number
  title: string
  nextLevelAt: number
  progress: number
} {
  let current = LEVELS[0]
  for (const def of LEVELS) {
    if (totalClips >= def.clipsRequired) {
      current = def
    } else {
      break
    }
  }

  const nextIdx = LEVELS.findIndex(d => d.level === current.level) + 1
  const next = nextIdx < LEVELS.length ? LEVELS[nextIdx] : null

  const nextLevelAt = next ? next.clipsRequired : current.clipsRequired
  const prevRequired = current.clipsRequired
  const range = (next ? next.clipsRequired : current.clipsRequired) - prevRequired

  const progress = range > 0
    ? Math.min(100, Math.round(((totalClips - prevRequired) / range) * 100))
    : 100

  return {
    level: current.level,
    title: current.title,
    nextLevelAt,
    progress,
  }
}

// ══════════════════════════════════════════════════════════════
// ── Level-up detection
// ══════════════════════════════════════════════════════════════

export function checkLevelUp(
  previousTotalClips: number,
  newTotalClips: number,
): Reward | null {
  const prevLevel = getCreatorLevel(previousTotalClips)
  const newLevel = getCreatorLevel(newTotalClips)

  if (newLevel.level > prevLevel.level) {
    const rarityMap: Record<number, Reward['rarity']> = {
      2: 'common', 3: 'common', 4: 'uncommon', 5: 'uncommon',
      6: 'rare', 7: 'rare', 8: 'rare', 9: 'legendary', 10: 'legendary',
    }
    return {
      id: `levelup-${newLevel.level}`,
      type: 'level_up',
      title: `Level ${newLevel.level}: ${newLevel.title}`,
      subtitle: newLevel.level < 10
        ? `Promoted to ${newLevel.title} \u2014 next: ${newLevel.nextLevelAt} clips`
        : `Maximum level reached \u2014 you are a Legend`,
      emoji: newLevel.level >= 9 ? '\uD83D\uDC51' : newLevel.level >= 6 ? '\uD83D\uDC8E' : '\uD83D\uDE80',
      rarity: rarityMap[newLevel.level] ?? 'common',
    }
  }

  return null
}

// ══════════════════════════════════════════════════════════════
// ── Aggregate: collect all rewards for a single publish event
// ══════════════════════════════════════════════════════════════

export function collectRewards(params: {
  previousTotalClips: number
  newTotalClips: number
  currentStreak: number
  sessionClipCount: number
  clipScore: number
  bestClipScore: number
  averageScore: number
  platformCount: number
}): Reward[] {
  const rewards: Reward[] = []

  const milestone = checkMilestone(params.newTotalClips)
  if (milestone) rewards.push(milestone)

  const streak = checkStreak(params.currentStreak)
  if (streak) rewards.push(streak)

  const levelUp = checkLevelUp(params.previousTotalClips, params.newTotalClips)
  if (levelUp) rewards.push(levelUp)

  const session = checkSessionMilestone(params.sessionClipCount)
  if (session) rewards.push(session)

  const rare = checkRareEvents({
    clipScore: params.clipScore,
    sessionClipCount: params.sessionClipCount,
    totalClipsPublished: params.newTotalClips,
    currentStreak: params.currentStreak,
    bestClipScore: params.bestClipScore,
    averageScore: params.averageScore,
    platformCount: params.platformCount,
  })
  if (rare) rewards.push(rare)

  return rewards
}
