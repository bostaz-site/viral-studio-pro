/**
 * Wrapper around the shared logAiCall for admin AI features.
 * Adds context_id + context_type for admin triage tracking.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const MODEL = 'claude-haiku-4-5-20251001'

const PRICING = { inputPer1M: 1.00, outputPer1M: 5.00 }

function computeCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICING.inputPer1M +
         (outputTokens / 1_000_000) * PRICING.outputPer1M
}

export interface AdminAiLogParams {
  feature: string
  contextId?: string
  contextType?: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  error?: string
}

export async function logAdminAiCall(params: AdminAiLogParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('ai_calls' as never).insert({
      model: MODEL,
      feature: params.feature,
      tokens_input: params.inputTokens,
      tokens_output: params.outputTokens,
      cached_tokens: 0,
      cost_usd: computeCost(params.inputTokens, params.outputTokens),
      latency_ms: params.latencyMs,
      success: params.success,
      error: params.error ?? null,
      context_id: params.contextId ?? null,
      context_type: params.contextType ?? null,
      metadata: null,
    } as never)
  } catch (err) {
    console.warn('[logAdminAiCall] Failed:', err instanceof Error ? err.message : err)
  }
}
