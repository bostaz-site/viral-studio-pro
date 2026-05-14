import { createAdminClient } from '@/lib/supabase/admin'

const HAIKU_INPUT_COST_PER_TOKEN = 0.25 / 1_000_000  // $0.25/1M
const HAIKU_OUTPUT_COST_PER_TOKEN = 1.25 / 1_000_000 // $1.25/1M

export function calculateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * HAIKU_INPUT_COST_PER_TOKEN + outputTokens * HAIKU_OUTPUT_COST_PER_TOKEN
}

/**
 * Log an AI scoring call to the ai_calls table.
 */
export async function logAiScoringCall(params: {
  feature: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  success: boolean
  error?: string
  contextId?: string
  contextType?: string
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('ai_calls').insert({
    feature: params.feature,
    model: params.model,
    tokens_input: params.inputTokens,
    tokens_output: params.outputTokens,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    success: params.success,
    error: params.error ?? null,
    context_id: params.contextId ?? null,
    context_type: params.contextType ?? null,
  })
}

/**
 * Check if daily cost limit has been exceeded.
 */
export async function getDailyCost(): Promise<number> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('ai_calls')
    .select('cost_usd')
    .eq('feature', 'batch_scoring')
    .gte('created_at', `${today}T00:00:00Z`)

  return (data ?? []).reduce((sum, row) => sum + (row.cost_usd ?? 0), 0)
}
