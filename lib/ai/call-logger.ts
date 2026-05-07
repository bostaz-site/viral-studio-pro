/**
 * AI Call Logger — tracks every AI API call with cost, tokens, and latency.
 * Inserts into `ai_calls` table via service_role client.
 * Fire-and-forget: never blocks the caller.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ── Pricing per model (USD) ──

interface TokenPricing {
  inputPer1M: number
  outputPer1M: number
}

interface AudioPricing {
  perSecondAudio: number
}

const TOKEN_PRICING: Record<string, TokenPricing> = {
  'claude-haiku-4-5-20251001': { inputPer1M: 1.00, outputPer1M: 5.00 },
  'claude-sonnet-4-5': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'gemini-flash-1.5': { inputPer1M: 0.075, outputPer1M: 0.30 },
}

const AUDIO_PRICING: Record<string, AudioPricing> = {
  'assemblyai-best': { perSecondAudio: 0.000103 },
}

function computeCost(params: {
  model: string
  tokensInput?: number
  tokensOutput?: number
  audioSeconds?: number
}): number {
  const { model, tokensInput, tokensOutput, audioSeconds } = params

  // Token-based models
  const tokenPrice = TOKEN_PRICING[model]
  if (tokenPrice) {
    const inputCost = ((tokensInput ?? 0) / 1_000_000) * tokenPrice.inputPer1M
    const outputCost = ((tokensOutput ?? 0) / 1_000_000) * tokenPrice.outputPer1M
    return inputCost + outputCost
  }

  // Audio-based models
  const audioPrice = AUDIO_PRICING[model]
  if (audioPrice && audioSeconds) {
    return audioSeconds * audioPrice.perSecondAudio
  }

  return 0
}

// ── Logger ──

export interface LogAiCallParams {
  userId?: string
  model: string
  feature: string
  tokensInput?: number
  tokensOutput?: number
  audioSeconds?: number
  latencyMs: number
  success: boolean
  error?: string
  metadata?: Record<string, unknown>
}

export async function logAiCall(params: LogAiCallParams): Promise<void> {
  try {
    const costUsd = computeCost({
      model: params.model,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      audioSeconds: params.audioSeconds,
    })

    const admin = createAdminClient()
    await admin.from('ai_calls' as never).insert({
      user_id: params.userId ?? null,
      model: params.model,
      feature: params.feature,
      tokens_input: params.tokensInput ?? null,
      tokens_output: params.tokensOutput ?? null,
      cost_usd: costUsd,
      latency_ms: params.latencyMs,
      success: params.success,
      error: params.error ?? null,
      metadata: params.metadata ?? null,
    } as never)
  } catch (err) {
    console.warn('[logAiCall] Failed to log AI call:', err instanceof Error ? err.message : err)
  }
}
