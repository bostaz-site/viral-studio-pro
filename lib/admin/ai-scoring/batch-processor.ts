import { getScraperDb } from '@/lib/admin/scraper/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreBatchWithClaude } from './claude-scorer'
import { calculateDynamicThreshold, getLearningModeSample } from './threshold-calculator'
import { getDailyCost } from './cost-tracker'
import type { LeadContext } from './prompt-builder'

const BATCH_SIZE = 10
const MAX_DAILY_COST_USD = 1.00
const MAX_RETRIES = 2

interface BatchResult {
  jobId: string
  processed: number
  failed: number
  totalCostUsd: number
  threshold: number
  mode: string
}

/**
 * Compute deterministic contactability score from scraper data.
 * 0-100 based on: has email, business contact, link count, email source quality.
 */
function computeContactabilityScore(lead: {
  has_email: boolean
  email: string | null
  links: string[] | null
  raw_data: { isBusinessContact?: boolean } | null
}): number {
  let score = 10 // Base: discoverable = some value

  if (lead.has_email && lead.email) {
    score += 40 // Has email = massive boost
    if (lead.raw_data?.isBusinessContact) {
      score += 20 // Business contact keyword proximity
    }
  }

  const linkCount = lead.links?.length ?? 0
  if (linkCount >= 3) score += 15
  else if (linkCount >= 1) score += 10

  // Has linktree or bio link = easy to reach
  const hasAggregator = (lead.links ?? []).some((l: string) =>
    /linktr\.ee|beacons\.ai|stan\.store|bio\.link/i.test(l)
  )
  if (hasAggregator) score += 15

  return Math.min(100, score)
}

/**
 * Process a batch of unscored leads above the dynamic threshold.
 * Called by the hourly cron job.
 */
export async function processAiScoringBatch(): Promise<BatchResult> {
  const db = getScraperDb()
  const supabase = createAdminClient()

  // Check daily cost limit
  const dailyCost = await getDailyCost()
  if (dailyCost >= MAX_DAILY_COST_USD) {
    return { jobId: '', processed: 0, failed: 0, totalCostUsd: dailyCost, threshold: 0, mode: '' }
  }

  // Calculate dynamic threshold
  const { threshold, mode } = await calculateDynamicThreshold()

  // Find unscored leads above threshold
  const { data: unscoredResults } = await db
    .from('lead_discovery_results')
    .select('id, platform_handle, display_name, bio, audience_size, engagement_rate, keyword_score, promoted_products, links, recent_post_titles, raw_data, has_email, email, influencer_id, recent_upload_count, last_upload_at')
    .eq('import_status', 'imported')
    .gte('keyword_score', threshold)
    .order('keyword_score', { ascending: false })
    .limit(BATCH_SIZE * 3)

  if (!unscoredResults?.length) {
    return { jobId: '', processed: 0, failed: 0, totalCostUsd: dailyCost, threshold, mode }
  }

  // Filter out already-scored leads (scored < 7 days ago)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allIds = unscoredResults.map((r: any) => r.id)
  const { data: recentlyScored } = await db
    .from('affiliate_signal_snapshots')
    .select('discovery_result_id')
    .in('discovery_result_id', allIds)
    .gte('scored_at', sevenDaysAgo)
    .not('ai_job_id', 'is', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentlyScoredIds = new Set<string>((recentlyScored ?? []).map((r: any) => r.discovery_result_id as string))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toScore = unscoredResults
    .filter((r: any) => !recentlyScoredIds.has(r.id))
    .slice(0, BATCH_SIZE)

  // In learning mode, add random sample from mid-range bucket
  if (mode === 'learning' && toScore.length < BATCH_SIZE) {
    const sampleIds = await getLearningModeSample(recentlyScoredIds, BATCH_SIZE - toScore.length)
    if (sampleIds.length > 0) {
      const { data: sampleLeads } = await db
        .from('lead_discovery_results')
        .select('id, platform_handle, display_name, bio, audience_size, engagement_rate, keyword_score, promoted_products, links, recent_post_titles, raw_data, has_email, email, influencer_id, recent_upload_count, last_upload_at')
        .in('id', sampleIds)

      if (sampleLeads?.length) {
        toScore = [...toScore, ...sampleLeads]
      }
    }
  }

  if (toScore.length === 0) {
    return { jobId: '', processed: 0, failed: 0, totalCostUsd: dailyCost, threshold, mode }
  }

  // Create job
  const { data: job } = await db
    .from('ai_scoring_jobs')
    .insert({
      job_type: 'batch_score',
      status: 'processing',
      total_leads: toScore.length,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const jobId = job?.id ?? ''

  let processed = 0
  let failed = 0
  let totalCostUsd = 0

  // Build lead contexts with cadence data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadInputs: LeadContext[] = toScore.map((r: any) => ({
    handle: r.platform_handle ?? 'unknown',
    displayName: r.display_name,
    bio: r.bio,
    followers: r.audience_size ?? 0,
    engagement: r.engagement_rate,
    recentPostTitles: r.recent_post_titles ?? [],
    recentVideoDescriptions: r.raw_data?.recentVideoDescriptions ?? [],
    promotedProducts: r.promoted_products ?? [],
    links: r.links ?? [],
    keywordScore: r.keyword_score ?? 0,
    strongSignals: r.raw_data?.strongSignals ?? [],
    recentUploadCount: r.recent_upload_count,
    lastUploadAt: r.last_upload_at,
  }))

  // Build contactability scores map
  const contactabilityScores = new Map<string, number>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of toScore as any[]) {
    const handle = (r.platform_handle ?? 'unknown').toLowerCase()
    const score = computeContactabilityScore(r)
    contactabilityScores.set(handle, score)

    // Write contactability_score back to lead_discovery_results
    await db
      .from('lead_discovery_results')
      .update({ contactability_score: score })
      .eq('id', r.id)
  }

  // Score with retries
  let retries = 0
  while (retries <= MAX_RETRIES) {
    try {
      const { results, costUsd } = await scoreBatchWithClaude(leadInputs, contactabilityScores, jobId)
      totalCostUsd += costUsd

      // Map results back to leads and update DB
      for (const scored of results) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchingResult = toScore.find((r: any) =>
          (r.platform_handle ?? '').toLowerCase() === (scored.handle ?? '').toLowerCase()
        )

        if (!matchingResult) continue

        // Update affiliate_signal_snapshots with V2 columns
        await db.from('affiliate_signal_snapshots').insert({
          influencer_id: matchingResult.influencer_id ?? null,
          discovery_result_id: matchingResult.id,
          keyword_score: matchingResult.keyword_score,
          ai_job_id: jobId,
          claude_model: 'claude-haiku-4-5-20251001',
          prompt_version: 2,
          cost_cents: costUsd * 100 / results.length,
          confidence: scored.confidence,
          ai_recommendation: scored.recommendation,
          ai_reasoning: scored.activation_reason,
          // V2 sub-scores
          ai_fit_score: scored.fit_score,
          ai_activation_score: scored.activation_score,
          ai_partner_intent_score: scored.partner_intent_score,
          ai_risk_score: scored.risk_score,
          ai_activation_reason: scored.activation_reason,
          ai_main_concern: scored.main_concern,
          ai_recommended_offer_angle: scored.recommended_offer_angle,
        })

        // Backward-compatible: update influencer AI score + compliment if imported
        if (matchingResult.influencer_id) {
          await supabase
            .from('influencers')
            .update({
              ai_affiliate_score: scored.ai_score,
              ai_scored_at: new Date().toISOString(),
              ai_recommendation: scored.recommendation,
              ai_specific_compliment: scored.specific_compliment || null,
            } as Record<string, unknown>)
            .eq('id', matchingResult.influencer_id)
        }

        processed++
      }

      break // Success, exit retry loop
    } catch (err) {
      retries++
      if (retries > MAX_RETRIES) {
        failed = toScore.length - processed
        console.error('[AI Scoring] Max retries exceeded:', err)
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * retries))
    }
  }

  // Update job
  await db
    .from('ai_scoring_jobs')
    .update({
      status: failed > 0 && processed === 0 ? 'failed' : 'completed',
      processed_leads: processed,
      failed_leads: failed,
      cost_cents: totalCostUsd * 100,
      completed_at: new Date().toISOString(),
      error_message: failed > 0 ? `${failed} leads failed after ${MAX_RETRIES} retries` : null,
    })
    .eq('id', jobId)

  return { jobId, processed, failed, totalCostUsd, threshold, mode }
}
