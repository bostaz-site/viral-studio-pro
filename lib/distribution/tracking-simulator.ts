/* ─── Post-Publication Metrics Simulator ───
 *
 * Generates chaotic, realistic-looking post metrics for the Distribution page
 * until real platform API tracking is wired up.
 * All output is deterministic per clipId + elapsed time.
 *
 * Realism features:
 *   - Platform-specific spike injection (TikTok frequent/small, YouTube rare/large)
 *   - Temporary drops & plateaus (organic feel)
 *   - Engagement lag (likes trail views, comments burst, shares sporadic)
 *   - Platform desync (different platforms grow at different paces)
 *   - ±12-18% jitter (noisy real-data feel)
 */

export interface PostMetrics {
  views: number
  likes: number
  comments: number
  shares: number
  growthPercent: number
  velocityLabel: string
  platformBreakdown: Record<string, { views: number; likes: number }>
}

/* ─── Deterministic seeded PRNG (mulberry32) ─── */
function seededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

/* ─── Platform configs ─── */
const PLATFORM_CONFIG: Record<string, {
  speedMult: number
  ceilingMult: number
  likeRate: number
  commentRate: number
  shareRate: number
  spikeChance: number    // probability of spike per interval
  spikeMin: number       // minimum spike multiplier
  spikeMax: number       // maximum spike multiplier
  phaseOffsetBase: number // base minutes of delay behind TikTok
}> = {
  tiktok: {
    speedMult: 1.4,
    ceilingMult: 1.3,
    likeRate: 0.06,
    commentRate: 0.008,
    shareRate: 0.015,
    spikeChance: 0.25,   // frequent
    spikeMin: 1.3,
    spikeMax: 2.0,       // small-medium
    phaseOffsetBase: 0,
  },
  youtube: {
    speedMult: 0.7,
    ceilingMult: 1.1,
    likeRate: 0.04,
    commentRate: 0.005,
    shareRate: 0.008,
    spikeChance: 0.12,   // rare
    spikeMin: 1.5,
    spikeMax: 2.5,       // large when they hit
    phaseOffsetBase: 15,
  },
  instagram: {
    speedMult: 1.0,
    ceilingMult: 0.9,
    likeRate: 0.08,
    commentRate: 0.012,
    shareRate: 0.01,
    spikeChance: 0.18,   // medium
    spikeMin: 1.4,
    spikeMax: 2.2,       // medium
    phaseOffsetBase: 8,
  },
}

/* ─── Chaos interval (5 min windows) ─── */
const CHAOS_INTERVAL = 5

/* ─── Growth curve ───
 *
 * Smooth base lifecycle of a viral clip:
 *   0–30min   : slow crawl (algo ingestion)
 *   30min–2h  : acceleration
 *   2h–6h    : peak growth
 *   6h–24h   : plateau / decline
 *
 * Returns 0-1 representing fraction of peak views reached.
 */
function growthCurve(minutes: number, speedMult: number): number {
  const t = minutes * speedMult

  if (t <= 0) return 0

  // Phase 1: slow start (0-30 min)
  if (t <= 30) {
    return 0.02 * (t / 30)
  }
  // Phase 2: acceleration (30 min - 120 min)
  if (t <= 120) {
    const progress = (t - 30) / 90
    return 0.02 + 0.28 * (progress * progress)
  }
  // Phase 3: peak growth (120 min - 360 min)
  if (t <= 360) {
    const progress = (t - 120) / 240
    return 0.30 + 0.55 * Math.sqrt(progress)
  }
  // Phase 4: plateau / slow tail (360 min+)
  const progress = (t - 360) / 1080
  const tail = Math.min(progress, 1)
  return 0.85 + 0.15 * (1 - Math.exp(-2 * tail))
}

/* ─── Peak views per platform based on clip score ─── */
function getPeakViews(clipScore: number, ceilingMult: number, rng: () => number): number {
  let basePeak: number
  if (clipScore >= 80) {
    basePeak = 15000 + rng() * 35000
  } else if (clipScore >= 60) {
    basePeak = 5000 + rng() * 15000
  } else {
    basePeak = 1000 + rng() * 7000
  }
  return Math.round(basePeak * ceilingMult)
}

/* ─── Chaos modifier for a single interval ───
 *
 * For each 5-min interval, deterministically decides:
 *   - Spike (platform-specific probability & magnitude)
 *   - Cooldown dip (always follows a spike)
 *   - Plateau / stall (10% chance)
 *   - Small dip (5% chance, -3% to -8%)
 *   - Normal with wide jitter (±12-18%)
 */
function getChaosMultiplier(
  interval: number,
  platformId: string,
  seed: number,
): number {
  const config = PLATFORM_CONFIG[platformId] ?? PLATFORM_CONFIG.tiktok

  const rng = seededRng(seed + hashString(platformId + ':chaos') + interval * 37)
  const roll = rng()

  // Check if previous interval was a spike → force cooldown dip
  if (interval > 0) {
    const prevRng = seededRng(seed + hashString(platformId + ':chaos') + (interval - 1) * 37)
    const prevRoll = prevRng()
    if (prevRoll < config.spikeChance) {
      // Post-spike cooldown: 85-95% of base
      return 0.85 + rng() * 0.10
    }
  }

  // Spike
  if (roll < config.spikeChance) {
    return config.spikeMin + rng() * (config.spikeMax - config.spikeMin)
  }

  // Plateau / stall (10%)
  const stallThreshold = config.spikeChance + 0.10
  if (roll < stallThreshold) {
    // Growth stalls: return a value that, when multiplied, roughly equals
    // what the previous interval produced (dampened growth)
    return 0.97 + rng() * 0.03
  }

  // Small dip (5%): -3% to -8%
  const dipThreshold = stallThreshold + 0.05
  if (roll < dipThreshold) {
    return 0.92 + rng() * 0.05
  }

  // Normal: wide jitter ±15% (range 0.85 to 1.15)
  return 0.85 + rng() * 0.30
}

/* ─── Engagement: likes with lag ─── */
function computeLikes(
  peakViews: number,
  minutesSincePublish: number,
  speedMult: number,
  likeRate: number,
  platformId: string,
  seed: number,
): number {
  // Likes lag behind views by 5-15 minutes (seeded per platform)
  const lagRng = seededRng(seed + hashString(platformId + ':likelag'))
  const lagMinutes = 5 + Math.floor(lagRng() * 10)
  const laggedMinutes = Math.max(0, minutesSincePublish - lagMinutes)

  const laggedCurve = growthCurve(laggedMinutes, speedMult)
  const laggedInterval = Math.floor(laggedMinutes / CHAOS_INTERVAL)
  const laggedChaos = getChaosMultiplier(laggedInterval, platformId, seed)

  const laggedViews = Math.max(0, peakViews * laggedCurve * laggedChaos)

  // Rate jitter ±20%
  const rateRng = seededRng(seed + hashString(platformId + ':likerate') + Math.floor(minutesSincePublish))
  const rateJitter = 0.80 + rateRng() * 0.40

  return Math.max(0, Math.round(laggedViews * likeRate * rateJitter))
}

/* ─── Engagement: comments in bursts ─── */
function computeComments(
  views: number,
  commentRate: number,
  minutesSincePublish: number,
  platformId: string,
  seed: number,
): number {
  const interval = Math.floor(minutesSincePublish / CHAOS_INTERVAL)
  const burstRng = seededRng(seed + hashString(platformId + ':commentburst'))

  // Each platform has a different burst cadence (every 3-6 intervals)
  const burstCadence = 3 + Math.floor(burstRng() * 4)
  const isBurstInterval = interval > 0 && interval % burstCadence === 0

  // Check if this specific interval is also a random burst (15% chance)
  const extraRng = seededRng(seed + hashString(platformId + ':commentextra') + interval * 13)
  const isExtraBurst = extraRng() < 0.15

  let mult: number
  if (isBurstInterval || isExtraBurst) {
    // Burst: 3-5x normal comment rate
    mult = 3.0 + extraRng() * 2.0
  } else {
    // Quiet: 10-30% of normal rate (a trickle)
    mult = 0.10 + extraRng() * 0.20
  }

  return Math.max(0, Math.round(views * commentRate * mult))
}

/* ─── Engagement: shares (rare & sporadic) ─── */
function computeShares(
  views: number,
  shareRate: number,
  minutesSincePublish: number,
  platformId: string,
  seed: number,
): number {
  const interval = Math.floor(minutesSincePublish / CHAOS_INTERVAL)
  const shareRng = seededRng(seed + hashString(platformId + ':share') + interval * 19)
  const roll = shareRng()

  // 30% of intervals produce shares, rest produce almost nothing
  if (roll < 0.30) {
    const burstMult = 1.5 + shareRng() * 2.5
    return Math.max(0, Math.round(views * shareRate * burstMult))
  }

  // Trickle: 0-10% of normal
  return Math.max(0, Math.round(views * shareRate * shareRng() * 0.10))
}

/* ─── Velocity label ─── */
function getVelocityLabel(minutes: number, clipScore: number): string {
  if (minutes <= 30) return 'Processing by algorithm'
  if (minutes <= 120) return clipScore > 70 ? 'Algorithm pickup detected' : 'Processing by algorithm'
  if (minutes <= 360) return clipScore > 70 ? 'Distribution expanding' : 'Algorithm pickup detected'
  return clipScore > 70 ? 'Distribution expanding' : 'Reaching saturation'
}

/* ─── Variant modifier ───
 * Applies risk/reward outcomes based on caption variant choice.
 * Uses seeded RNG so the outcome is deterministic per clip+platform.
 */
function getVariantModifier(
  variantId: 'high-ctr' | 'safe-reach' | 'viral-bait' | undefined,
  platformId: string,
  seed: number,
): number {
  if (!variantId) return 1.0

  const rng = seededRng(seed + hashString(platformId + ':variant'))
  const roll = rng()

  switch (variantId) {
    case 'viral-bait':
      // 35% failure mode: plateau at 30-50% of peak
      if (roll < 0.35) return 0.30 + rng() * 0.20
      // 65% boosted mode: 1.5-2.0x
      return 1.50 + rng() * 0.50

    case 'high-ctr':
      // 15% slight underperformance: 85% of normal
      if (roll < 0.15) return 0.85
      // 85% boost: 1.2-1.4x
      return 1.20 + rng() * 0.20

    case 'safe-reach':
      // Consistent: tight 0.9-1.1x range
      return 0.90 + rng() * 0.20

    default:
      return 1.0
  }
}

/* ─── Main simulation function ─── */
export function simulatePostMetrics(params: {
  clipScore: number
  platforms: string[]
  minutesSincePublish: number
  clipId: string
  variantId?: 'high-ctr' | 'safe-reach' | 'viral-bait'
}): PostMetrics {
  const { clipScore, platforms, minutesSincePublish, clipId, variantId } = params
  const seed = hashString(clipId)

  let totalViews = 0
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0
  const platformBreakdown: Record<string, { views: number; likes: number }> = {}

  for (const platformId of platforms) {
    const config = PLATFORM_CONFIG[platformId] ?? PLATFORM_CONFIG.tiktok

    // Each platform gets its own deterministic RNG stream
    const rng = seededRng(seed + hashString(platformId))

    // Platform desync: seeded phase offset so platforms don't grow in lockstep
    const offsetRng = seededRng(seed + hashString(platformId + ':offset'))
    const phaseOffset = config.phaseOffsetBase + Math.floor(offsetRng() * 10)
    const effectiveMinutes = Math.max(0, minutesSincePublish - phaseOffset)

    const variantMod = getVariantModifier(variantId, platformId, seed)
    const peakViews = Math.round(getPeakViews(clipScore, config.ceilingMult, rng) * variantMod)
    const baseCurve = growthCurve(effectiveMinutes, config.speedMult)

    // Chaos modifier for the current interval
    const interval = Math.floor(effectiveMinutes / CHAOS_INTERVAL)
    const chaos = getChaosMultiplier(interval, platformId, seed)

    const views = Math.max(0, Math.round(peakViews * baseCurve * chaos))

    const likes = computeLikes(
      peakViews, effectiveMinutes, config.speedMult,
      config.likeRate, platformId, seed,
    )

    const comments = computeComments(
      views, config.commentRate, effectiveMinutes,
      platformId, seed,
    )

    const shares = computeShares(
      views, config.shareRate, effectiveMinutes,
      platformId, seed,
    )

    totalViews += views
    totalLikes += likes
    totalComments += comments
    totalShares += shares
    platformBreakdown[platformId] = { views, likes }
  }

  // Growth percent vs baseline (score-50 clip)
  const baselineRng = seededRng(seed + 999)
  const baselineTotal = platforms.reduce((sum, pid) => {
    const config = PLATFORM_CONFIG[pid] ?? PLATFORM_CONFIG.tiktok
    const basePeak = getPeakViews(50, config.ceilingMult, baselineRng)
    const curve = growthCurve(minutesSincePublish, config.speedMult)
    return sum + basePeak * curve
  }, 0)

  const growthPercent = baselineTotal > 0
    ? Math.round(((totalViews - baselineTotal) / baselineTotal) * 100)
    : 0

  const velocityLabel = getVelocityLabel(minutesSincePublish, clipScore)

  return {
    views: totalViews,
    likes: totalLikes,
    comments: totalComments,
    shares: totalShares,
    growthPercent,
    velocityLabel,
    platformBreakdown,
  }
}

/* ─── Display helpers ─── */

export function formatMetricCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1000000).toFixed(1)}M`
}

export function getTimeElapsedLabel(minutes: number): string {
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${Math.floor(minutes)} min ago`
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60)
    return `${h}h ago`
  }
  const d = Math.floor(minutes / 1440)
  return `${d}d ago`
}
