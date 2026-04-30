/* ─── Caption Engine ─── */
/* Block-based caption generation with combinatorial mixing.
   Uses seeded randomness (clip ID) so same clip = same result.
   Hook x Bridge x Payoff x Amplifier blocks create ~2,000+ unique
   captions per tone/variant combination. */

// ── Types ──

export interface BioVariant {
  id: 'high-ctr' | 'safe-reach' | 'viral-bait'
  label: string
  style: string
  color: 'orange' | 'emerald' | 'red'
  caption: string
  hashtags: string[]
  reachMultiplier: number
  failureChance: number
  riskLabel: string
  projectedReachLabel: string
}

export type Tone =
  | 'rage' | 'funny' | 'hype' | 'skill' | 'fail'
  | 'wholesome' | 'controversial' | 'educational' | 'emotional'
  | 'general'

type VariantId = BioVariant['id']

// ── Seeded randomness ──

function seededHash(seed: string, index: number): number {
  let h = 0x9e3779b9
  const combined = `${seed}:${index}`
  for (let i = 0; i < combined.length; i++) {
    h = Math.imul(h ^ combined.charCodeAt(i), 0x5bd1e995)
    h ^= h >>> 15
  }
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 0x100000000
}

function seededPick<T>(arr: readonly T[], seed: string, index: number): T {
  return arr[Math.floor(seededHash(seed, index) * arr.length)]
}

function seededShuffle<T>(arr: readonly T[], seed: string, index: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(seededHash(seed, index + i * 7) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ── Stop words for topic extraction ──

const STOP_WORDS = new Set([
  'the', 'this', 'that', 'with', 'from', 'what', 'when', 'where',
  'which', 'while', 'about', 'into', 'then', 'than', 'them', 'they',
  'their', 'there', 'been', 'have', 'will', 'would', 'could', 'should',
  'does', 'doing', 'done', 'just', 'very', 'really', 'only', 'even',
  'also', 'most', 'some', 'after', 'before', 'over', 'under', 'again',
  'here', 'were', 'being', 'each', 'more', 'made', 'like', 'still',
  'back', 'much', 'many', 'your', 'gets', 'goes',
])

// ── Tone detection ──

const TONE_PATTERNS: Array<{ tone: Tone; patterns: RegExp }> = [
  { tone: 'rage',          patterns: /\b(rage|angry|mad|tilted|furious|raging|mald|malding|toxic|screaming|yelling)\b/ },
  { tone: 'funny',         patterns: /\b(funny|lol|humor|comedy|laugh|hilarious|lmao|rofl|comedic|joke|meme|goofy|clown)\b/ },
  { tone: 'hype',          patterns: /\b(insane|crazy|nuts|wild|unreal|absurd|godlike|legendary|epic|bonkers|mental|madness)\b/ },
  { tone: 'skill',         patterns: /\b(clutch|win|play|skill|ace|outplay|carry|cracked|goated|mechanical|flick|headshot|snipe)\b/ },
  { tone: 'fail',          patterns: /\b(fail|choke|miss|lost|throw|threw|blunder|disaster|rip|whiff|grief|int|feeding)\b/ },
  { tone: 'wholesome',     patterns: /\b(wholesome|sweet|kind|heartwarming|cute|adorable|friendship|love|support|hug|thanks|grateful)\b/ },
  { tone: 'controversial', patterns: /\b(drama|beef|called out|exposed|banned|cancelled|cheating|exploit|hack|drama|fight|argument|toxic)\b/ },
  { tone: 'educational',   patterns: /\b(how to|guide|tutorial|learn|tip|trick|secret|strategy|explained|breakdown|analysis|lesson)\b/ },
  { tone: 'emotional',     patterns: /\b(crying|tears|emotional|goodbye|farewell|last|final|quit|retire|end|tribute|sad|heartbreak)\b/ },
]

export function detectTone(title: string): { tone: Tone; topic: string } {
  const lower = title.toLowerCase()

  let detectedTone: Tone = 'general'
  for (const { tone, patterns } of TONE_PATTERNS) {
    if (patterns.test(lower)) {
      detectedTone = tone
      break
    }
  }

  const words = title
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
  const topic = words.slice(0, 3).join(' ') || title

  return { tone: detectedTone, topic }
}

// ══════════════════════════════════════════════════════════════
// ── Caption block pools
// ══════════════════════════════════════════════════════════════

// ── Hooks per tone (8-10 each) ──
// Strings with {topic} are selected when topic goes in hook position.

const HOOKS: Record<Tone, readonly string[]> = {
  rage: [
    'STOP SCROLLING.',
    'I\'ve never seen anyone this mad.',
    'This is PEAK tilt right here.',
    'You can FEEL the rage through the screen.',
    'The most tilted moment of the year.',
    '{topic} completely lost it.',
    '{topic} snapped and nobody was ready.',
    'What made {topic} this angry is actually insane.',
    'I\'ve seen rage before but {topic} just set a new record.',
    'Nobody talks about {topic}\'s rage like this.',
  ],
  funny: [
    'I can\'t stop laughing.',
    'Comedy gold right here.',
    'This is the funniest clip you\'ll see all week.',
    'The timing on this is PERFECT.',
    'If this doesn\'t make you laugh nothing will.',
    '{topic} wasn\'t even trying to be funny.',
    'The way {topic} reacted is absolutely priceless.',
    'I\'ve watched {topic} do this 30 times and it gets better every time.',
    '{topic} just created the funniest moment in streaming history.',
  ],
  hype: [
    'STOP SCROLLING.',
    'I\'ve never seen anything like this.',
    'This shouldn\'t be possible.',
    'Nobody was ready for this.',
    'Wait for it...',
    'The moment everything changed.',
    'I had to rewatch this 5 times.',
    'This is why {topic} is different.',
    'What {topic} just did is unreal.',
    '{topic} just changed the game forever.',
  ],
  skill: [
    'This shouldn\'t be humanly possible.',
    'Someone call the esports scouts.',
    'Peak performance looks like this.',
    'This is the definition of CRACKED.',
    'I refuse to believe this was legit.',
    'The {topic} play that pros are studying right now.',
    '{topic} just hit the most insane play I\'ve ever seen.',
    'How does {topic} make it look THIS easy?',
    '{topic} proving why they\'re built different.',
    'Watch what {topic} does and try not to lose it.',
  ],
  fail: [
    'I literally gasped.',
    'How do you even mess this up THIS bad?',
    'The WORST timing imaginable.',
    'This fail is going to haunt them forever.',
    'We\'ve ALL been there... but not this bad.',
    '{topic} had the most unfortunate moment ever.',
    '{topic} really said "hold my keyboard" and did THIS.',
    'What {topic} does at 0:12 had me questioning reality.',
    '{topic} doesn\'t want this clip to exist.',
    'The {topic} fail that ended a career.',
  ],
  wholesome: [
    'Stop everything and watch this.',
    'I\'m actually tearing up right now.',
    'This restored my faith in everything.',
    'We don\'t deserve this kind of content.',
    'Pure serotonin.',
    '{topic} just had the most wholesome moment on stream.',
    'I dare you to watch {topic} and not smile.',
    'This {topic} moment is why streaming matters.',
    '{topic} proving the community can be amazing.',
  ],
  controversial: [
    'Nobody is supposed to see this.',
    'The clip that\'s being mass-deleted right now.',
    'This was NOT supposed to go public.',
    'Multiple people tried to bury this.',
    'Make up your own mind on this one.',
    '{topic} just got EXPOSED on stream.',
    'The {topic} drama nobody is talking about.',
    '{topic} thought nobody was watching. They were WRONG.',
    'What {topic} said live changes everything.',
  ],
  educational: [
    'Take notes on this one.',
    'Why is NOBODY talking about this trick?',
    'This changes EVERYTHING we thought we knew.',
    'The secret that top players don\'t want you to know.',
    'I tried this for 1 week and the results were INSANE.',
    '{topic} just revealed the strategy everyone was hiding.',
    'The {topic} breakdown that makes everyone rethink their approach.',
    '{topic} explaining it in a way that finally makes sense.',
    '{topic} leaked something that was supposed to stay secret.',
  ],
  emotional: [
    'I was NOT ready for this.',
    'This hit different.',
    'I had to take a break after watching this.',
    'The most genuine moment you\'ll see today.',
    'I\'m genuinely speechless.',
    '{topic} just made 50K people cry at the same time.',
    'When {topic} realized what happened... the reaction destroyed me.',
    'The {topic} moment that\'s too raw to share. But it needs to be seen.',
    'What {topic} said in the last 10 seconds... I\'m not okay.',
  ],
  general: [
    'STOP SCROLLING.',
    'Wait for it...',
    'Nobody was ready for this.',
    'I had to rewatch this 5 times.',
    'This shouldn\'t be possible.',
    'The moment everything changed.',
    'I\'ve never seen anything like this.',
    '{topic} just broke the internet.',
    'This {topic} clip is going viral for a reason.',
    '{topic} just did something nobody saw coming.',
  ],
}

// ── Bridges ──
// AFTER_TOPIC: follow a topic name in bridge position ("shroud just shocked everyone")
// STANDALONE: work as independent sentences (when topic is in hook or payoff)

const BRIDGES_AFTER_TOPIC: readonly string[] = [
  'just shocked everyone',
  'and nobody can believe it',
  'proved everyone wrong',
  'and the reaction says it all',
  'had everyone losing it',
  'did something nobody expected',
  'and the internet can\'t handle it',
  'made everyone question everything',
]

const BRIDGES_STANDALONE: readonly string[] = [
  'Nobody saw this coming',
  'The reaction says it all',
  'This changes everything we thought we knew',
  'Watch what happens at the end',
  'And here\'s why it matters',
  'But that\'s not even the craziest part',
  'The internet is losing its mind over this',
  'Everyone needs to see this',
]

// ── Payoffs per variant type (8-10 each) ──
// Strings with {topic} are selected when topic goes in payoff position.

const PAYOFFS: Record<VariantId, readonly string[]> = {
  'high-ctr': [
    'This is INSANE.',
    'I\'m still processing this.',
    'The internet is NOT ready.',
    'This needs to go viral.',
    'I can\'t stop watching.',
    'Share this before it gets deleted.',
    'NOBODY is talking about this enough.',
    'How is this not trending yet?',
    '{topic} just made history with this one.',
    'This is the craziest {topic} moment ever.',
  ],
  'safe-reach': [
    'One of the best clips this week.',
    'Pure quality content right here.',
    'This deserves way more views.',
    'Incredible moment all around.',
    'Content like this is why I\'m here.',
    'Easily one of the cleanest clips I\'ve seen.',
    'Solid content that speaks for itself.',
    '{topic} deserves so much more recognition for this.',
    'This is exactly the kind of {topic} content we need.',
    'Quality {topic} moment worth sharing.',
  ],
  'viral-bait': [
    '...and there\'s a reason nobody is talking about it.',
    'Watch till the end to understand why.',
    'This was quietly deleted but we saved it.',
    'The real story is in the comments.',
    'Ask yourself why this isn\'t on the front page.',
    'The truth behind this will shock you.',
    'You won\'t see this anywhere else.',
    '{topic} didn\'t want this getting out.',
    'The real {topic} story that nobody will cover.',
    'What they don\'t want you to know about {topic}.',
  ],
}

// ── Amplifiers per variant (4-6 each, 50% chance to include) ──

const AMPLIFIERS: Record<VariantId, readonly string[]> = {
  'high-ctr': [
    'I\'m CRYING.',
    'BRUH.',
    'No way.',
    'Literally insane.',
    'Send this to someone who needs to see it.',
    'I\'m actually shaking.',
  ],
  'safe-reach': [
    'Genuinely worth your time.',
    'You\'ll want to see this.',
    'Trust me on this one.',
    'Just watch.',
    'This one hits different.',
  ],
  'viral-bait': [
    'They really tried to bury this.',
    'Save this before it disappears.',
    'You\'ve been warned.',
    'Don\'t say I didn\'t tell you.',
    'Make this go viral.',
    'Repost this everywhere.',
  ],
}

// ══════════════════════════════════════════════════════════════
// ── Assembly logic
// ══════════════════════════════════════════════════════════════

function assembleCaption(
  tone: Tone,
  variantId: VariantId,
  topic: string,
  seed: string,
  variantIndex: number,
): string {
  const hooks = HOOKS[tone] ?? HOOKS.general
  const payoffs = PAYOFFS[variantId]
  const amplifiers = AMPLIFIERS[variantId]

  // ── Determine topic position (40% hook, 30% bridge, 30% payoff) ──
  const posRand = seededHash(seed, variantIndex * 1000)
  const topicPos: 'hook' | 'bridge' | 'payoff' =
    posRand < 0.4 ? 'hook' : posRand < 0.7 ? 'bridge' : 'payoff'

  // ── Split pools by {topic} presence ──
  const hooksWithTopic = hooks.filter(h => h.includes('{topic}'))
  const hooksPlain = hooks.filter(h => !h.includes('{topic}'))
  const payoffsWithTopic = payoffs.filter(p => p.includes('{topic}'))
  const payoffsPlain = payoffs.filter(p => !p.includes('{topic}'))

  const hIdx = variantIndex * 10 + 1
  const bIdx = variantIndex * 10 + 2
  const pIdx = variantIndex * 10 + 3

  let hook: string
  let bridgeText: string
  let payoff: string

  if (topicPos === 'hook') {
    hook = seededPick(hooksWithTopic.length > 0 ? hooksWithTopic : hooks, seed, hIdx)
    bridgeText = seededPick(BRIDGES_STANDALONE, seed, bIdx)
    payoff = seededPick(payoffsPlain.length > 0 ? payoffsPlain : payoffs, seed, pIdx)
  } else if (topicPos === 'bridge') {
    hook = seededPick(hooksPlain.length > 0 ? hooksPlain : hooks, seed, hIdx)
    const bridgeVerb = seededPick(BRIDGES_AFTER_TOPIC, seed, bIdx)
    bridgeText = `${topic} ${bridgeVerb}`
    payoff = seededPick(payoffsPlain.length > 0 ? payoffsPlain : payoffs, seed, pIdx)
  } else {
    hook = seededPick(hooksPlain.length > 0 ? hooksPlain : hooks, seed, hIdx)
    bridgeText = seededPick(BRIDGES_STANDALONE, seed, bIdx)
    payoff = seededPick(payoffsWithTopic.length > 0 ? payoffsWithTopic : payoffs, seed, pIdx)
  }

  // ── Replace {topic} placeholders ──
  const r = (s: string) => s.replace(/\{topic\}/g, topic)
  hook = r(hook)
  bridgeText = r(bridgeText)
  payoff = r(payoff)

  // ── Capitalize bridge first letter ──
  bridgeText = bridgeText.charAt(0).toUpperCase() + bridgeText.slice(1)

  // ── Assemble ──
  // Payoffs starting with "..." get a space separator, others get ". "
  const payoffSep = payoff.startsWith('...') ? ' ' : '. '
  let caption = `${hook} ${bridgeText}${payoffSep}${payoff}`

  // ── Maybe amplifier (50% chance) ──
  if (seededHash(seed, variantIndex * 10 + 5) < 0.5 && amplifiers.length > 0) {
    caption += ' ' + seededPick(amplifiers, seed, variantIndex * 10 + 4)
  }

  // ── Safety: if topic never appeared, prepend it ──
  if (!caption.toLowerCase().includes(topic.toLowerCase().slice(0, 5)) && topic.length > 3) {
    caption = `${topic} \u2014 ${caption}`
  }

  return caption
}

// ══════════════════════════════════════════════════════════════
// ── Hashtag system
// ══════════════════════════════════════════════════════════════

const BASE_HASHTAGS: readonly string[] = [
  '#viral', '#fyp', '#clips', '#shorts', '#trending', '#content',
  '#mustwatch', '#foryou', '#explore', '#highlights',
]

const TONE_HASHTAGS: Record<Tone, readonly string[]> = {
  rage: [
    '#rage', '#tilted', '#gaming', '#streamer', '#mad', '#malding',
    '#toxic', '#gamerrage', '#triggered', '#raging', '#saltmine',
    '#gamingfail', '#tilt', '#screaming', '#mald', '#salt',
  ],
  funny: [
    '#funny', '#comedy', '#lol', '#dying', '#streamer', '#hilarious',
    '#lmao', '#meme', '#humor', '#gamingfunny', '#funnymoments',
    '#comedygold', '#clown', '#goofy', '#laughing', '#dead',
  ],
  hype: [
    '#insane', '#omg', '#gaming', '#hype', '#epic', '#unreal',
    '#godlike', '#legendary', '#bonkers', '#wild', '#crazyclip',
    '#hypemoment', '#poggers', '#noway', '#clutch', '#goated',
  ],
  skill: [
    '#skills', '#pro', '#gaming', '#clutch', '#cracked', '#goated',
    '#montage', '#mechanical', '#outplay', '#progamer', '#esports',
    '#highlight', '#skillcheck', '#godgamer', '#insane', '#ace',
  ],
  fail: [
    '#fail', '#gaming', '#rip', '#streamer', '#oof', '#choke',
    '#blunder', '#disaster', '#gamingfail', '#whiff', '#throw',
    '#sadge', '#painchamp', '#failclip', '#unlucky', '#bruh',
  ],
  wholesome: [
    '#wholesome', '#heartwarming', '#cute', '#gaming', '#streamer',
    '#sweet', '#love', '#community', '#positivity', '#goodvibes',
    '#serotonin', '#kindness', '#blessed', '#faith', '#respect',
    '#purejoy',
  ],
  controversial: [
    '#drama', '#exposed', '#gaming', '#streamer', '#truth', '#cancelled',
    '#beef', '#controversy', '#calledout', '#banned', '#leaked',
    '#tea', '#receipts', '#shocking', '#noway', '#unfiltered',
  ],
  educational: [
    '#tips', '#guide', '#tutorial', '#gaming', '#learn', '#howto',
    '#strategy', '#pro', '#breakdown', '#explained', '#secret',
    '#gametips', '#improve', '#protips', '#hack', '#masterclass',
  ],
  emotional: [
    '#emotional', '#crying', '#tears', '#gaming', '#streamer',
    '#farewell', '#goodbye', '#real', '#heartbreak', '#tribute',
    '#powerful', '#sad', '#raw', '#genuine', '#respect', '#deep',
  ],
  general: [
    '#gaming', '#streamer', '#omg', '#noway', '#bestclips',
    '#epicmoment', '#watchthis', '#gamingclips', '#insane', '#epic',
    '#incredible', '#unreal', '#hype', '#esports', '#live', '#stream',
  ],
}

const TRENDING_DAILY: readonly string[] = [
  '#trending', '#goviral', '#blowup', '#algorithm', '#foryoupage',
]

function pickHashtags(tone: Tone, seed: string, variantIndex: number): string[] {
  // Merge base + tone-specific
  const pool = [...BASE_HASHTAGS, ...(TONE_HASHTAGS[tone] ?? TONE_HASHTAGS.general)]
  // Deduplicate
  const unique = [...new Set(pool)]
  const shuffled = seededShuffle(unique, seed, variantIndex * 100)

  // Pick 5-8 hashtags (seeded count)
  const count = 5 + Math.floor(seededHash(seed, variantIndex * 100 + 99) * 4) // 5,6,7,8
  const selected = shuffled.slice(0, count)

  // 20% chance to include a trending daily hashtag
  if (seededHash(seed, variantIndex * 100 + 50) < 0.2) {
    const trendingTag = seededPick(TRENDING_DAILY, seed, variantIndex * 100 + 51)
    if (!selected.includes(trendingTag)) {
      selected.push(trendingTag)
    }
  }

  return selected
}

// ══════════════════════════════════════════════════════════════
// ── Strategy messages
// ══════════════════════════════════════════════════════════════

const STRATEGY_MESSAGES: readonly string[] = [
  // Time-of-day insights
  'Peak TikTok engagement happens between 7-9 PM on weekdays.',
  'YouTube Shorts posted before noon get 18% more initial push.',
  'Instagram Reels perform best between 11 AM and 1 PM.',
  'Posting after 10 PM catches the late-night scroll audience.',
  'Morning posts (7-9 AM) capture the commuter audience on mobile.',
  'Lunchtime posts (12-1 PM) see a spike in shares and saves.',

  // Day-of-week insights
  'Monday morning posts get 23% more algorithmic reach on average.',
  'Wednesday and Thursday are the highest-engagement days across platforms.',
  'Weekend posts get fewer views but higher engagement rates.',
  'Friday evening is peak time for entertainment and gaming content.',
  'Sunday night posts ride the pre-week content wave.',
  'Avoid posting Tuesday 2-4 PM \u2014 lowest engagement window of the week.',

  // Platform-specific insights
  'TikTok favors fast hooks \u2014 first 1.5 seconds decide everything.',
  'YouTube Shorts rewards watch time more than any other signal.',
  'Instagram Reels with text overlays get 28% more saves.',
  'TikTok clips under 30 seconds have 40% higher completion rates.',
  'YouTube Shorts has the longest tail \u2014 views keep coming for weeks.',
  'Instagram audiences engage more with polished, aesthetic content.',
  'TikTok audiences prefer raw, unfiltered moments over polished edits.',

  // Multi-platform strategy
  'Multi-platform posting increases total reach by 2.4x on average.',
  'Stagger posts by 2-3 hours across platforms for maximum reach.',
  'Each platform has unique peak hours \u2014 don\'t post everywhere at once.',
  'TikTok first, then YouTube Shorts 2h later, Instagram 4h later.',
  'Cross-posting the same clip to 3+ platforms triples discoverability.',

  // Content strategy
  'Clips with a strong hook in the first 3 seconds retain 70% more viewers.',
  'Posting consistently (daily) signals quality to every algorithm.',
  'Engagement in the first 30 minutes determines viral potential.',
  'Replying to comments within 1 hour boosts algorithmic ranking.',
  'Clips shared via DM get 3x more follow-through views.',
  'Clips with captions/subtitles get 56% more watch time on average.',
  'Adding a CTA ("follow for more") increases follower conversion by 32%.',

  // Seasonal and trending
  'Gaming content peaks during major tournament seasons.',
  'Holiday periods see 30% more average watch time.',
  'Trending audio on TikTok can boost reach by 5-10x.',
  'Riding a trending topic within 6 hours gives maximum algorithm boost.',
  'New game launches create a 48-hour content goldmine.',

  // Engagement patterns
  'Clips that trigger comments ("what would you do?") get 3x more reach.',
  'Controversial takes generate 4x more shares than neutral content.',
  'Duets and stitches on TikTok extend clip lifespan by 72 hours.',
  'Series-style clips ("Part 1, Part 2") increase profile visits by 45%.',
  'Reposting top performers after 2 weeks can recapture 30% of original views.',
  'Clips with a surprise at the end get 65% more replays.',
  'Emotional reactions (crying, shock) outperform skill clips 2-to-1 in shares.',
]

export function getRandomStrategyMessages(count: number, seed: string): string[] {
  const shuffled = seededShuffle(STRATEGY_MESSAGES, seed, 0)
  return shuffled.slice(0, Math.min(count, STRATEGY_MESSAGES.length))
}

// ══════════════════════════════════════════════════════════════
// ── Reach projection helpers
// ══════════════════════════════════════════════════════════════

function formatReach(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`
  return `${Math.round(n / 1000)}K`
}

function computeReachLabel(
  variantId: VariantId,
  reachMultiplier: number,
  clipScore: number,
  platformCount: number,
): string {
  const base = clipScore * platformCount
  if (variantId === 'viral-bait') {
    // Wider range for risky variant
    const low = base * 0.5 * 150
    const high = base * 2.0 * 300
    return `${formatReach(low)}-${formatReach(high)}`
  }
  const low = base * reachMultiplier * 150
  const high = base * reachMultiplier * 300
  return `${formatReach(low)}-${formatReach(high)}`
}

// ── Risk/reward configs per variant
// ══════════════════════════════════════════════════════════════

const VARIANT_RISK: Record<VariantId, {
  reachMultiplier: number
  failureChance: number
  riskLabel: string
}> = {
  'high-ctr': { reachMultiplier: 1.3, failureChance: 15, riskLabel: 'Proven formula' },
  'safe-reach': { reachMultiplier: 1.0, failureChance: 5, riskLabel: 'Safe & steady' },
  'viral-bait': { reachMultiplier: 2.0, failureChance: 35, riskLabel: 'High risk, high reward' },
}

// ── Main export
// ══════════════════════════════════════════════════════════════

export function generateVariants(title: string, clipId?: string, params?: {
  clipScore?: number
  platformCount?: number
}): BioVariant[] {
  const { tone, topic } = detectTone(title)
  const seed = clipId ?? title
  const score = params?.clipScore ?? 50
  const platforms = params?.platformCount ?? 1

  const variantIds: VariantId[] = ['high-ctr', 'safe-reach', 'viral-bait']
  const labels: Record<VariantId, string> = {
    'high-ctr': 'Best',
    'safe-reach': 'Alternative',
    'viral-bait': 'Risky',
  }
  const styles: Record<VariantId, string> = {
    'high-ctr': 'Aggressive hook, urgency',
    'safe-reach': 'Clean, broad audience',
    'viral-bait': 'Curiosity gap, polarizing',
  }
  const colors: Record<VariantId, 'orange' | 'emerald' | 'red'> = {
    'high-ctr': 'orange',
    'safe-reach': 'emerald',
    'viral-bait': 'red',
  }

  return variantIds.map((id, i) => {
    const risk = VARIANT_RISK[id]
    return {
      id,
      label: labels[id],
      style: styles[id],
      color: colors[id],
      caption: assembleCaption(tone, id, topic, seed, i),
      hashtags: pickHashtags(tone, seed, i),
      reachMultiplier: risk.reachMultiplier,
      failureChance: risk.failureChance,
      riskLabel: risk.riskLabel,
      projectedReachLabel: computeReachLabel(id, risk.reachMultiplier, score, platforms),
    }
  })
}
