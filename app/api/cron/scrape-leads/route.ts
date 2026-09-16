/**
 * Cron: scrape-leads — autopilot YouTube scraper for affiliate leads.
 * Schedule: daily 06:00 ET via cron-job.org — NOT VERIFIED (not yet added)
 * Auth: x-api-key = CRON_SECRET (timingSafeCompare)
 *
 * Picks the 8 enabled scraper_queries with oldest last_run_at,
 * runs YouTube search + enrich + email extraction + keyword scoring,
 * auto-imports eligible leads (subs 5k–1M, upload ≤60d, has email).
 * Quota guard: stops when YouTube API usage > 5000 units/day.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeCompare } from '@/lib/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getScraperDb } from '@/lib/admin/scraper/db'
import {
  searchYouTubeChannels,
  extractEmailsFromText,
  getRecentVideoDescriptions,
  extractUrlsFromText,
  type EmailSource,
} from '@/lib/admin/scraper/youtube'
import { crawlExternalLinksForEmails } from '@/lib/admin/scraper/link-crawler'
import { keywordAffiliateScore } from '@/lib/admin/scraper/keyword-scorer'
import { detectPromotedProducts, distributorGraphBonus } from '@/lib/admin/scraper/distributor-graph'
import { trackQuotaUsage, getRemainingQuota } from '@/lib/admin/scraper/quota-tracker'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'

export const dynamic = 'force-dynamic'

const MAX_QUERIES_PER_RUN = 8
const QUOTA_CEILING = 5000
const MAX_SEARCHES_PER_DAY = 40
const MIN_SUBS = 5000
const MAX_SUBS = 1_000_000
const MAX_DAYS_SINCE_UPLOAD = 60

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET
  if (!apiKey || !cronSecret || !timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getScraperDb()
  const admin = createAdminClient()

  // Quota guard
  const quota = await getRemainingQuota('youtube_api')
  if (quota.remaining < QUOTA_CEILING) {
    return jsonResponse({
      data: { skipped: true, reason: 'quota_ceiling', remaining: quota.remaining },
      error: null,
    })
  }

  // Pick 8 oldest enabled queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: queries, error: qErr } = await (db as any)
    .from('scraper_queries')
    .select('id, query, niche')
    .eq('enabled', true)
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(MAX_QUERIES_PER_RUN)

  if (qErr || !queries || queries.length === 0) {
    return jsonResponse({ data: { skipped: true, reason: 'no_enabled_queries' }, error: null })
  }

  let totalImported = 0
  let totalFound = 0
  let totalQuotaUsed = 0
  let queriesRun = 0
  const rejected: Array<{ handle: string; reason: string }> = []

  for (const sq of queries as Array<{ id: string; query: string; niche: string }>) {
    // Check quota before each search
    const currentQuota = await getRemainingQuota('youtube_api')
    if (currentQuota.remaining < QUOTA_CEILING || queriesRun >= MAX_SEARCHES_PER_DAY) break

    try {
      // Create discovery run
      const { data: run } = await db
        .from('lead_discovery_runs')
        .insert({
          source: 'youtube_api',
          query: sq.query,
          filters: { cron: true, niche: sq.niche },
          status: 'running',
          started_by: null,
        })
        .select('id')
        .single()

      if (!run) continue

      const { channels, quotaUsed } = await searchYouTubeChannels({
        query: sq.query,
        maxResults: 15,
        language: 'en',
        regionCode: 'US',
      })

      await trackQuotaUsage('youtube_api', quotaUsed)
      totalQuotaUsed += quotaUsed
      queriesRun++

      let queryResults = 0

      for (const ch of channels) {
        // Filter: subs range
        if (ch.subscriberCount < MIN_SUBS || ch.subscriberCount > MAX_SUBS) {
          rejected.push({ handle: ch.handle || ch.id, reason: `subs_${ch.subscriberCount}` })
          continue
        }

        const profileUrl = `https://youtube.com/${ch.handle ? '@' + ch.handle : 'channel/' + ch.id}`

        // Email extraction (channel description first)
        const channelEmails = extractEmailsFromText(ch.description)
        let primaryEmail = channelEmails[0]?.email ?? null
        let emailSource: EmailSource | null = primaryEmail ? 'channel_description' : null
        let emailSourceUrl: string | null = primaryEmail ? profileUrl : null
        let isBusinessContact = channelEmails[0]?.isBusinessContact ?? false
        let lastUploadAt: string | null = null
        let recentUploadCount = 0
        const channelVideoTitles: string[] = []
        const allDescriptions = [ch.description]

        // Enrich with video descriptions
        try {
          const { descriptions, cadence, quotaUsed: vQuota } = await getRecentVideoDescriptions(ch.id, 10)
          await trackQuotaUsage('youtube_api', vQuota)
          totalQuotaUsed += vQuota
          lastUploadAt = cadence.lastUploadAt
          recentUploadCount = cadence.recentUploadCount
          channelVideoTitles.push(...descriptions.map(d => d.title).filter(Boolean))
          for (const vd of descriptions) allDescriptions.push(vd.description)

          if (!primaryEmail) {
            const emailOccurrences = new Map<string, number>()
            for (const vd of descriptions) {
              for (const ve of extractEmailsFromText(vd.description)) {
                emailOccurrences.set(ve.email, (emailOccurrences.get(ve.email) ?? 0) + 1)
                if (ve.isBusinessContact) isBusinessContact = true
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
              }
            }
          }
        } catch { /* non-fatal */ }

        // External link crawling for email
        if (!primaryEmail) {
          try {
            const crawlResults = await crawlExternalLinksForEmails(allDescriptions)
            if (crawlResults.length > 0) {
              const best = crawlResults.sort((a, b) => {
                const p: Record<string, number> = { external_site: 0, linktree: 1 }
                return (p[a.source] ?? 2) - (p[b.source] ?? 2)
              })[0]
              primaryEmail = best.email
              emailSource = best.source
              emailSourceUrl = best.sourceUrl
              isBusinessContact = best.isBusinessContact || isBusinessContact
            }
          } catch { /* non-fatal */ }
        }

        // Filter: must have email
        if (!primaryEmail) {
          rejected.push({ handle: ch.handle || ch.id, reason: 'no_email' })
          continue
        }

        // Filter: last upload ≤ 60 days
        if (lastUploadAt) {
          const daysSince = (Date.now() - new Date(lastUploadAt).getTime()) / (1000 * 60 * 60 * 24)
          if (daysSince > MAX_DAYS_SINCE_UPLOAD) {
            rejected.push({ handle: ch.handle || ch.id, reason: `inactive_${Math.round(daysSince)}d` })
            continue
          }
        }

        // Scoring
        const allLinks = [...ch.links]
        for (const desc of allDescriptions) {
          for (const u of extractUrlsFromText(desc)) {
            if (!allLinks.includes(u)) allLinks.push(u)
          }
        }

        const { score } = keywordAffiliateScore({
          bio: ch.description,
          linksCount: allLinks.length,
          links: allLinks,
          hasEmail: true,
        })
        const products = detectPromotedProducts(ch.description)
        const graphBonus = distributorGraphBonus(products)
        const totalScore = Math.min(100, score + graphBonus)

        // Cross-run dedup: check existing
        const { data: existing } = await db
          .from('lead_discovery_results')
          .select('id')
          .eq('platform', 'youtube')
          .eq('platform_id', ch.id)
          .maybeSingle()

        const rowData = {
          run_id: run.id,
          platform: 'youtube',
          platform_id: ch.id,
          platform_handle: ch.handle,
          display_name: ch.title,
          profile_url: profileUrl,
          avatar_url: ch.thumbnailUrl,
          bio: ch.description?.slice(0, 2000),
          audience_size: ch.subscriberCount,
          language: ch.country,
          country: ch.country,
          niche: sq.niche,
          has_email: true,
          email: primaryEmail,
          email_source: emailSource,
          email_source_url: emailSourceUrl,
          recent_post_titles: channelVideoTitles.slice(0, 5),
          recent_video_titles: channelVideoTitles.slice(0, 10),
          links: allLinks,
          keyword_score: totalScore,
          promoted_products: products.map(p => p.productName),
          recent_upload_count: recentUploadCount,
          last_upload_at: lastUploadAt,
          raw_data: { subscriberCount: ch.subscriberCount, videoCount: ch.videoCount, viewCount: ch.viewCount, isBusinessContact } as Record<string, unknown>,
        }

        if (existing) {
          await db.from('lead_discovery_results').update({ ...rowData, discovered_at: new Date().toISOString() }).eq('id', (existing as Record<string, unknown>).id)
        } else {
          await db.from('lead_discovery_results').insert(rowData)
        }

        totalFound++
        queryResults++

        // Auto-import: check suppression + dedup in influencers
        const suppressed = await checkSuppressed(admin, primaryEmail, ch.handle)
        if (!suppressed) {
          const { data: existingInf } = await (admin as ReturnType<typeof Object>)
            .from('influencers')
            .select('id')
            .or(`email.eq.${primaryEmail},platform_handle.eq.${ch.handle || '___'}`)
            .maybeSingle()

          if (!existingInf) {
            await (admin as ReturnType<typeof Object>).from('influencers').insert({
              email: primaryEmail,
              display_name: ch.title,
              platform_handle: ch.handle,
              primary_platform: 'youtube',
              platform_url: profileUrl,
              audience_size: ch.subscriberCount,
              niche: sq.niche,
              language: ch.country || 'en',
              country: ch.country,
              status: 'cold',
              source: 'scraper_youtube',
              lead_score: totalScore,
              tags: products.length > 0 ? ['has_competitor_products'] : [],
              recent_video_titles: channelVideoTitles.slice(0, 5),
              upload_cadence_days: recentUploadCount > 0 ? Math.round(14 / recentUploadCount) : null,
            })
            totalImported++
          }
        }
      }

      // Update query metadata
      await (db as ReturnType<typeof Object>)
        .from('scraper_queries')
        .update({
          last_run_at: new Date().toISOString(),
          results_total: queryResults,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sq.id)

      // Update run status
      await db.from('lead_discovery_runs').update({ status: 'completed' }).eq('id', run.id)
    } catch (err) {
      console.error(`[scrape-leads] Query "${sq.query}" failed:`, (err as Error).message)
    }
  }

  return jsonResponse({
    data: {
      queries_run: queriesRun,
      channels_found: totalFound,
      imported: totalImported,
      rejected: rejected.length,
      rejected_sample: rejected.slice(0, 10),
      quota_used: totalQuotaUsed,
    },
    error: null,
  })
}

async function checkSuppressed(admin: ReturnType<typeof createAdminClient>, email: string, handle: string | null): Promise<boolean> {
  const { data } = await (admin as ReturnType<typeof Object>)
    .from('suppression_list')
    .select('id')
    .or(`email.eq.${email}${handle ? `,platform_handle.eq.${handle}` : ''}`)
    .limit(1)
  return (data ?? []).length > 0
}
