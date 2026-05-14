const NICHE_GROUPS: Record<string, string[]> = {
  gaming: ['gaming', 'fps', 'moba', 'esports', 'minecraft', 'valorant', 'fortnite', 'league'],
  streaming: ['twitch', 'kick', 'irl', 'just_chatting', 'variety'],
  tech: ['tech', 'ai', 'saas', 'productivity', 'apps', 'software'],
  creator: ['content_creator', 'youtuber', 'tiktoker', 'influencer', 'creator'],
  business: ['business', 'finance', 'entrepreneur', 'startup', 'marketing'],
  lifestyle: ['fitness', 'beauty', 'cooking', 'music', 'fashion'],
}

function expandNiche(niche: string): Set<string> {
  const lower = niche.toLowerCase()
  const expanded = new Set<string>([lower])
  for (const group of Object.values(NICHE_GROUPS)) {
    if (group.includes(lower)) {
      for (const n of group) expanded.add(n)
    }
  }
  return expanded
}

export function scoreNicheMatch(
  videoNiches: string[],
  influencerNiche: string | null,
  influencerTags: string[]
): { score: number; matchedNiches: string[] } {
  if (!videoNiches.length) return { score: 15, matchedNiches: [] }

  const influencerSet = new Set<string>()
  if (influencerNiche) for (const n of expandNiche(influencerNiche)) influencerSet.add(n)
  for (const tag of influencerTags) influencerSet.add(tag.toLowerCase())

  if (influencerSet.size === 0) return { score: 10, matchedNiches: [] }

  const matched: string[] = []
  for (const vn of videoNiches) {
    const expanded = expandNiche(vn)
    for (const n of expanded) {
      if (influencerSet.has(n)) { matched.push(vn); break }
    }
  }

  return { score: Math.min(matched.length * 15, 35), matchedNiches: matched }
}
