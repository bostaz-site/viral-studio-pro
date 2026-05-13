import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'
import { searchYouTubeChannels, extractEmailsFromText } from '@/lib/admin/scraper/youtube'
import { keywordAffiliateScore } from '@/lib/admin/scraper/keyword-scorer'
import { detectPromotedProducts, distributorGraphBonus } from '@/lib/admin/scraper/distributor-graph'
import { trackQuotaUsage, getRemainingQuota } from '@/lib/admin/scraper/quota-tracker'

const searchSchema = z.object({
  query: z.string().min(3).max(200),
  maxResults: z.number().int().min(5).max(50).optional(),
  language: z.string().max(5).optional(),
  regionCode: z.string().max(2).optional(),
  savedSearchId: z.string().uuid().optional(),
})

// POST — run YouTube search
export const POST = withAdmin(async (req, user) => {
  const body = await req.json()
  const parsed = searchSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  // Check quota
  const quota = await getRemainingQuota('youtube_api')
  if (quota.remaining < 150) {
    return errorResponse(`YouTube API quota low: ${quota.remaining} units remaining (need ~101)`, 429)
  }

  const supabase = getScraperDb()

  // Create discovery run
  const { data: run } = await supabase
    .from('lead_discovery_runs')
    .insert({
      source: 'youtube_api',
      query: parsed.data.query,
      filters: JSON.parse(JSON.stringify(parsed.data)) as Record<string, string>,
      status: 'running',
      started_by: user.id,
    })
    .select('id')
    .single()

  if (!run) return errorResponse('Failed to create run', 500)

  try {
    const { channels, quotaUsed } = await searchYouTubeChannels({
      query: parsed.data.query,
      maxResults: parsed.data.maxResults,
      language: parsed.data.language,
      regionCode: parsed.data.regionCode,
    })

    await trackQuotaUsage('youtube_api', quotaUsed)

    // Process each channel
    let newLeads = 0
    let duplicates = 0
    const results = []

    for (const ch of channels) {
      // Extract emails from description
      const emails = extractEmailsFromText(ch.description)
      const primaryEmail = emails[0]?.email ?? null

      // Keyword pre-score
      const { score, strongSignals, mediumSignals } = keywordAffiliateScore({
        bio: ch.description,
        linksCount: ch.links.length,
        links: ch.links,
      })

      // Distributor graph
      const products = detectPromotedProducts(ch.description)
      const graphBonus = distributorGraphBonus(products)
      const totalScore = Math.min(100, score + graphBonus)

      // Check for existing duplicate
      const { data: existing } = await supabase
        .from('lead_discovery_results')
        .select('id')
        .eq('platform', 'youtube')
        .eq('platform_id', ch.id)
        .eq('run_id', run.id)
        .maybeSingle()

      if (existing) { duplicates++; continue }

      const { data: result } = await supabase
        .from('lead_discovery_results')
        .insert({
          run_id: run.id,
          platform: 'youtube',
          platform_id: ch.id,
          platform_handle: ch.handle,
          display_name: ch.title,
          profile_url: `https://youtube.com/${ch.handle ? '@' + ch.handle : 'channel/' + ch.id}`,
          avatar_url: ch.thumbnailUrl,
          bio: ch.description?.slice(0, 2000),
          audience_size: ch.subscriberCount,
          niche: null,
          language: ch.country,
          country: ch.country,
          recent_post_titles: [],
          links: ch.links,
          keyword_score: totalScore,
          has_email: !!primaryEmail,
          email: primaryEmail,
          email_source_url: primaryEmail ? `https://youtube.com/${ch.handle ? '@' + ch.handle : 'channel/' + ch.id}/about` : null,
          promoted_products: products.map(p => p.productName),
          raw_data: { subscriberCount: ch.subscriberCount, videoCount: ch.videoCount, viewCount: ch.viewCount, strongSignals, mediumSignals } as Record<string, unknown>,
        })
        .select('id, platform_handle, display_name, audience_size, keyword_score, has_email, promoted_products')
        .single()

      if (result) {
        results.push(result)
        newLeads++
      }
    }

    // Update run status
    await supabase
      .from('lead_discovery_runs')
      .update({
        status: 'completed',
        results_count: channels.length,
        new_leads_count: newLeads,
        duplicates_count: duplicates,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    // Update saved search if provided
    if (parsed.data.savedSearchId) {
      await supabase
        .from('scraper_saved_searches')
        .update({ last_run_at: new Date().toISOString(), run_count: newLeads + duplicates })
        .eq('id', parsed.data.savedSearchId)
    }

    return jsonResponse({
      run_id: run.id,
      total: channels.length,
      new_leads: newLeads,
      duplicates,
      quota_used: quotaUsed,
      results,
    })
  } catch (err) {
    await supabase
      .from('lead_discovery_runs')
      .update({ status: 'failed', errors: [{ message: err instanceof Error ? err.message : 'Unknown' }] as unknown as Record<string, string> })
      .eq('id', run.id)

    return errorResponse(err instanceof Error ? err.message : 'Search failed', 500)
  }
})

// GET — list results for a run
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const runId = url.searchParams.get('run_id')
  const status = url.searchParams.get('status')
  const minScore = parseInt(url.searchParams.get('min_score') ?? '0')

  const supabase = getScraperDb()

  let query = supabase
    .from('lead_discovery_results')
    .select('*')
    .gte('keyword_score', minScore)
    .order('keyword_score', { ascending: false })
    .limit(100)

  if (runId) query = query.eq('run_id', runId)
  if (status) query = query.eq('import_status', status)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  return jsonResponse(data)
})
