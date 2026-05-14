import { getScraperDb } from '@/lib/admin/scraper/db'

/**
 * Calculate dynamic threshold for AI scoring (top 3% of keyword scores).
 * Only leads scoring above this get sent to Claude.
 */
export async function calculateDynamicThreshold(): Promise<number> {
  const db = getScraperDb()

  const { data } = await db
    .from('lead_discovery_results')
    .select('keyword_score')
    .order('keyword_score', { ascending: false })
    .limit(1000)

  if (!data?.length || data.length < 30) return 50 // Default minimum

  // Top 3% = index at 3% of total
  const idx = Math.max(0, Math.floor(data.length * 0.03) - 1)
  const threshold = data[idx]?.keyword_score ?? 50

  // Never go below 40 (too many low-quality leads)
  return Math.max(40, threshold)
}
