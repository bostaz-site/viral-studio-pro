import { getScraperDb } from '@/lib/admin/scraper/db'

type ScoringMode = 'learning' | 'optimized'

function getScoringMode(): ScoringMode {
  const mode = process.env.AI_SCORING_MODE ?? 'learning'
  return mode === 'optimized' ? 'optimized' : 'learning'
}

/**
 * Calculate dynamic threshold for AI scoring.
 *
 * Modes:
 * - 'learning' (default): top 10% of keyword_score + random 3% sample from 40-70 bucket
 *   → scores more leads to build training data for calibration
 * - 'optimized': top 3% only (production mode once calibrated)
 */
export async function calculateDynamicThreshold(): Promise<{ threshold: number; mode: ScoringMode }> {
  const mode = getScoringMode()
  const db = getScraperDb()

  const { data } = await db
    .from('lead_discovery_results')
    .select('keyword_score')
    .order('keyword_score', { ascending: false })
    .limit(1000)

  if (!data?.length || data.length < 30) return { threshold: 50, mode }

  if (mode === 'learning') {
    // Top 10% threshold
    const idx = Math.max(0, Math.floor(data.length * 0.10) - 1)
    const threshold = data[idx]?.keyword_score ?? 40
    return { threshold: Math.max(30, threshold), mode }
  }

  // Optimized: top 3%
  const idx = Math.max(0, Math.floor(data.length * 0.03) - 1)
  const threshold = data[idx]?.keyword_score ?? 50
  return { threshold: Math.max(40, threshold), mode }
}

/**
 * In learning mode, also select a random sample from the 40-70 keyword_score bucket.
 * These "middle of the road" leads help calibrate the model.
 */
export async function getLearningModeSample(
  alreadyScoredIds: Set<string>,
  maxSample: number = 3,
): Promise<string[]> {
  if (getScoringMode() !== 'learning') return []

  const db = getScraperDb()

  const { data } = await db
    .from('lead_discovery_results')
    .select('id')
    .gte('keyword_score', 40)
    .lte('keyword_score', 70)
    .eq('import_status', 'imported')
    .limit(100)

  if (!data?.length) return []

  // Filter out already scored, then random sample
  const eligible = data
    .filter((r: { id: string }) => !alreadyScoredIds.has(r.id))

  // Fisher-Yates shuffle and take first N
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }

  return eligible.slice(0, maxSample).map((r: { id: string }) => r.id)
}
