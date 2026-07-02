import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'
import { searchYouTubeChannels, extractEmailsFromText, getRecentVideoDescriptions, extractUrlsFromText, type EmailSource } from '@/lib/admin/scraper/youtube'
import { crawlExternalLinksForEmails } from '@/lib/admin/scraper/link-crawler'
import { keywordAffiliateScore } from '@/lib/admin/scraper/keyword-scorer'
import { detectPromotedProducts, distributorGraphBonus } from '@/lib/admin/scraper/distributor-graph'
import { trackQuotaUsage, getRemainingQuota } from '@/lib/admin/scraper/quota-tracker'

const searchSchema = z.object({
  query: z.string().min(3).max(200),
  maxResults: z.number().int().min(5).max(25).optional(),
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

    // Process channels in parallel batches of 5
    let newLeads = 0
    let duplicates = 0
    let totalQuotaUsed = quotaUsed
    let enrichedCount = 0
    const MAX_ENRICHED = 15 // Netlify ~26s timeout — limit deep enrichment
    const results: Array<Record<string, unknown>> = []

    const processChannel = async (ch: typeof channels[number], index: number) => {
      const profileUrl = `https://youtube.com/${ch.handle ? '@' + ch.handle : 'channel/' + ch.id}`

      // --- Step 1: Channel description emails ---
      const channelEmails = extractEmailsFromText(ch.description)
      let primaryEmail = channelEmails[0]?.email ?? null
      let emailSource: EmailSource | null = primaryEmail ? 'channel_description' : null
      let emailSourceUrl: string | null = primaryEmail ? profileUrl : null
      let isBusinessContact = channelEmails[0]?.isBusinessContact ?? false
      let channelCadence: { recentUploadCount: number; lastUploadAt: string | null } = { recentUploadCount: 0, lastUploadAt: null }
      let channelVideoTitles: string[] = []

      // Collect all description texts for link extraction later
      const allDescriptions = [ch.description]

      // --- Step 2: Video descriptions (for email extraction + cadence data) ---
      if (index < MAX_ENRICHED) {
        try {
          const { descriptions, cadence, quotaUsed: videoQuota } = await getRecentVideoDescriptions(ch.id, 10)
          totalQuotaUsed += videoQuota
          await trackQuotaUsage('youtube_api', videoQuota)
          channelCadence = cadence
          channelVideoTitles = descriptions.map(vd => vd.title).filter(Boolean)

          // Extract emails from video descriptions (only if no email found yet)
          for (const vd of descriptions) {
            allDescriptions.push(vd.description)
          }

          if (!primaryEmail) {
            const emailOccurrences = new Map<string, number>()
            const businessKeywords = /business|sponsor|collab|partnership|inquir|booking|press|media|pr\b/i

            for (const vd of descriptions) {
              const vEmails = extractEmailsFromText(vd.description)
              for (const ve of vEmails) {
                emailOccurrences.set(ve.email, (emailOccurrences.get(ve.email) ?? 0) + 1)
                if (businessKeywords.test(ve.context)) {
                  isBusinessContact = true
                }
              }
            }

            if (emailOccurrences.size > 0) {
              let bestEmail: string | null = null
              let bestCount = 0
              for (const [email, count] of emailOccurrences) {
                if (count > bestCount) { bestEmail = email; bestCount = count }
              }

              if (bestEmail) {
                primaryEmail = bestEmail
                emailSource = 'video_description'
                emailSourceUrl = profileUrl
                if (bestCount >= 3) isBusinessContact = true
              }
            }
          }

          enrichedCount++
        } catch {
          // Video enrichment failure should not block the channel
        }
      }

      // --- Step 3: External link crawling (only if still no email and within budget) ---
      if (!primaryEmail && index < MAX_ENRICHED) {
        try {
          const crawlResults = await crawlExternalLinksForEmails(allDescriptions)
          if (crawlResults.length > 0) {
            // Priority: external_site > linktree
            const sorted = crawlResults.sort((a, b) => {
              const priority: Record<string, number> = { external_site: 0, linktree: 1 }
              return (priority[a.source] ?? 2) - (priority[b.source] ?? 2)
            })
            const best = sorted[0]
            primaryEmail = best.email
            emailSource = best.source
            emailSourceUrl = best.sourceUrl
            isBusinessContact = best.isBusinessContact || isBusinessContact
          }
        } catch {
          // Link crawling failure should not block the channel
        }
      }

      // Contactability score (independent of keyword score)
      const contactabilityScore = getContactabilityScore(emailSource)

      // Keyword pre-score (with email boost)
      const { score, strongSignals, mediumSignals } = keywordAffiliateScore({
        bio: ch.description,
        linksCount: ch.links.length,
        links: ch.links,
        hasEmail: !!primaryEmail,
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

      if (existing) { duplicates++; return }

      // Collect all external URLs found across descriptions
      const allLinks = [...ch.links]
      for (const desc of allDescriptions) {
        const urls = extractUrlsFromText(desc)
        for (const u of urls) {
          if (!allLinks.includes(u)) allLinks.push(u)
        }
      }

      const { data: result } = await supabase
        .from('lead_discovery_results')
        .insert({
          run_id: run.id,
          platform: 'youtube',
          platform_id: ch.id,
          platform_handle: ch.handle,
          display_name: ch.title,
          profile_url: profileUrl,
          avatar_url: ch.thumbnailUrl,
          bio: ch.description?.slice(0, 2000),
          audience_size: ch.subscriberCount,
          niche: null,
          language: ch.country,
          country: ch.country,
          recent_post_titles: channelVideoTitles.slice(0, 5),
          recent_video_titles: channelVideoTitles.slice(0, 10),
          links: allLinks,
          keyword_score: totalScore,
          contactability_score: contactabilityScore,
          has_email: !!primaryEmail,
          email: primaryEmail,
          email_source: emailSource,
          email_source_url: emailSourceUrl,
          promoted_products: products.map(p => p.productName),
          recent_upload_count: channelCadence.recentUploadCount,
          last_upload_at: channelCadence.lastUploadAt,
          raw_data: { subscriberCount: ch.subscriberCount, videoCount: ch.videoCount, viewCount: ch.viewCount, strongSignals, mediumSignals, isBusinessContact } as Record<string, unknown>,
        })
        .select('id, platform_handle, display_name, audience_size, keyword_score, has_email, promoted_products')
        .single()

      if (result) {
        results.push(result)
        newLeads++
      }
    }

    // Batch parallel processing (5 at a time) to avoid Netlify timeout
    const BATCH_SIZE = 5
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map((ch, batchIdx) => processChannel(ch, i + batchIdx)))
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
      quota_used: totalQuotaUsed,
      enrichment_depth: enrichedCount,
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

function getContactabilityScore(source: EmailSource | null): number {
  switch (source) {
    case 'external_site': return 90
    case 'linktree': return 80
    case 'video_description': return 70
    case 'channel_description': return 60
    default: return 0
  }
}

// GET — list results for a run
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const runId = url.searchParams.get('run_id')
  const status = url.searchParams.get('status')
  const minScore = parseInt(url.searchParams.get('min_score') ?? '0')
  const hasEmail = url.searchParams.get('has_email')

  const supabase = getScraperDb()

  let query = supabase
    .from('lead_discovery_results')
    .select('*')
    .gte('keyword_score', minScore)
    .order('keyword_score', { ascending: false })
    .limit(100)

  if (runId) query = query.eq('run_id', runId)
  if (status) query = query.eq('import_status', status)
  if (hasEmail === 'true') query = query.eq('has_email', true)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  return jsonResponse(data)
})
