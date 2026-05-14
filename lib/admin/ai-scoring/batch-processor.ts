import { getScraperDb } from '@/lib/admin/scraper/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreBatchWithClaude } from './claude-scorer'
import { calculateDynamicThreshold } from './threshold-calculator'
import { getDailyCost } from './cost-tracker'

const BATCH_SIZE = 10
const MAX_DAILY_COST_USD = 1.00
const MAX_RETRIES = 2

interface BatchResult {
  jobId: string
  processed: number
  failed: number
  totalCostUsd: number
  threshold: number
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
    return { jobId: '', processed: 0, failed: 0, totalCostUsd: dailyCost, threshold: 0 }
  }

  // Calculate dynamic threshold (top 3%)
  const threshold = await calculateDynamicThreshold()

  // Find unscored leads above threshold
  const { data: unscoredResults } = await db
    .from('lead_discovery_results')
    .select('id, platform_handle, display_name, bio, audience_size, engagement_rate, keyword_score, promoted_products, links, recent_post_titles, raw_data')
    .eq('import_status', 'imported')
    .gte('keyword_score', threshold)
    .order('keyword_score', { ascending: false })
    .limit(BATCH_SIZE * 3) // Get more than needed for cache check

  if (!unscoredResults?.length) {
    return { jobId: '', processed: 0, failed: 0, totalCostUsd: dailyCost, threshold }
  }

  // Filter out already-scored leads (scored < 7 days ago)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentlyScored } = await db
    .from('affiliate_signal_snapshots')
    .select('discovery_result_id')
    .in('discovery_result_id', unscoredResults.map((r: any) => r.id))
    .gte('scored_at', sevenDaysAgo)
    .not('ai_job_id', 'is', null)

  const recentlyScoredIds = new Set((recentlyScored ?? []).map((r: any) => r.discovery_result_id))
  const toScore = unscoredResults
    .filter((r: any) => !recentlyScoredIds.has(r.id))
    .slice(0, BATCH_SIZE)

  if (toScore.length === 0) {
    return { jobId: '', processed: 0, failed: 0, totalCostUsd: dailyCost, threshold }
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

  // Build lead contexts
  const leadInputs = toScore.map((r: any) => ({
    handle: r.platform_handle ?? 'unknown',
    displayName: r.display_name,
    bio: r.bio,
    followers: r.audience_size ?? 0,
    engagement: r.engagement_rate,
    recentPostTitles: r.recent_post_titles ?? [],
    promotedProducts: r.promoted_products ?? [],
    links: r.links ?? [],
    keywordScore: r.keyword_score ?? 0,
    strongSignals: r.raw_data?.strongSignals ?? [],
  }))

  // Score with retries
  let retries = 0
  while (retries <= MAX_RETRIES) {
    try {
      const { results, costUsd } = await scoreBatchWithClaude(leadInputs, jobId)
      totalCostUsd += costUsd

      // Map results back to leads and update DB
      for (const scored of results) {
        const matchingResult = toScore.find((r: any) =>
          (r.platform_handle ?? '').toLowerCase() === (scored.handle ?? '').toLowerCase()
        )

        if (!matchingResult) continue

        // Update affiliate_signal_snapshots
        await db.from('affiliate_signal_snapshots').insert({
          influencer_id: matchingResult.influencer_id ?? null,
          discovery_result_id: matchingResult.id,
          keyword_score: matchingResult.keyword_score,
          ai_job_id: jobId,
          claude_model: 'claude-haiku-4-5-20251001',
          prompt_version: 1,
          cost_cents: costUsd * 100 / results.length,
          confidence: scored.confidence,
          strengths: scored.strengths as unknown as Record<string, string>,
          concerns: scored.concerns as unknown as Record<string, string>,
          ai_recommendation: scored.recommendation,
          ai_reasoning: scored.reasoning,
        })

        // Update influencer AI score if imported
        if (matchingResult.influencer_id) {
          await supabase
            .from('influencers')
            .update({
              ai_affiliate_score: scored.ai_score,
              ai_scored_at: new Date().toISOString(),
              ai_recommendation: scored.recommendation,
            } as any)
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
      // Wait before retry
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

  return { jobId, processed, failed, totalCostUsd, threshold }
}
