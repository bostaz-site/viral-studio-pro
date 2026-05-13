import { getScraperDb } from '@/lib/admin/scraper/db'

/**
 * Track YouTube API quota usage (10,000 units/day free tier).
 */
export async function trackQuotaUsage(source: string, units: number): Promise<void> {
  const supabase = getScraperDb()
  const today = new Date().toISOString().split('T')[0]

  // Upsert: increment units_used and calls_made for today
  const { data: existing } = await supabase
    .from('scraper_quota_usage')
    .select('id, units_used, calls_made')
    .eq('source', source)
    .eq('date', today)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('scraper_quota_usage')
      .update({
        units_used: (existing.units_used ?? 0) + units,
        calls_made: (existing.calls_made ?? 0) + 1,
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('scraper_quota_usage')
      .insert({
        source,
        date: today,
        units_used: units,
        calls_made: 1,
        units_limit: source === 'youtube_api' ? 10000 : 0,
      })
  }
}

/**
 * Get remaining quota for a source today.
 */
export async function getRemainingQuota(source: string): Promise<{ used: number; limit: number; remaining: number }> {
  const supabase = getScraperDb()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('scraper_quota_usage')
    .select('units_used, units_limit')
    .eq('source', source)
    .eq('date', today)
    .maybeSingle()

  const used = data?.units_used ?? 0
  const limit = data?.units_limit ?? (source === 'youtube_api' ? 10000 : 0)

  return { used, limit, remaining: Math.max(0, limit - used) }
}
