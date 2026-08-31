import { NextRequest } from 'next/server'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { candidateCheckInputSchema, type CandidateCheckResult } from '@/lib/schemas/candidate-check'
import { logger } from '@/lib/logger'

const VPS_URL = process.env.VPS_RENDER_URL
const VPS_KEY = process.env.VPS_RENDER_API_KEY

interface CachedRow {
  candidate_flags: string[] | null
  candidate_metrics: Record<string, unknown> | null
  candidate_checked_at: string | null
}

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = candidateCheckInputSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 400)
  }

  const { clipId, videoUrl, fallbackUrl } = parsed.data
  if (!videoUrl && !fallbackUrl) {
    return errorResponse('At least one of videoUrl or fallbackUrl is required', 400)
  }

  const admin = createAdminClient()

  // Check cache — never analyze the same clip twice
  // New columns not in generated types yet — cast through unknown
  const { data: rawCached } = await (admin
    .from('trending_clips')
    .select('candidate_flags, candidate_metrics, candidate_checked_at')
    .eq('id', clipId)
    .single() as unknown as Promise<{ data: CachedRow | null }>)

  if (rawCached?.candidate_checked_at) {
    return jsonResponse({
      ...(rawCached.candidate_metrics ?? {}),
      flags: rawCached.candidate_flags ?? [],
      cached: true,
    })
  }

  // Call VPS analyze-candidate endpoint
  if (!VPS_URL || !VPS_KEY) {
    return jsonResponse({ flags: [], error: 'VPS not configured' })
  }

  let result: CandidateCheckResult
  try {
    const vpsRes = await fetch(`${VPS_URL}/api/analyze-candidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': VPS_KEY,
      },
      body: JSON.stringify({ videoUrl, fallbackUrl, clipId }),
      signal: AbortSignal.timeout(35_000),
    })

    if (!vpsRes.ok) {
      const errText = await vpsRes.text().catch(() => 'unknown')
      logger.error(`[candidate-check] VPS returned ${vpsRes.status}: ${errText}`)
      return jsonResponse({ flags: [], error: `VPS error: ${vpsRes.status}` })
    }

    result = await vpsRes.json() as CandidateCheckResult
  } catch (err) {
    logger.error(`[candidate-check] VPS call failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return jsonResponse({ flags: [], error: 'Analysis timed out' })
  }

  // Cache result in trending_clips (best-effort)
  try {
    const metrics: Record<string, unknown> = {
      darkSecondsRatio: result.darkSecondsRatio,
      longestDarkStretch: result.longestDarkStretch,
      speechRatio: result.speechRatio,
      longestSilence: result.longestSilence,
      totalDuration: result.totalDuration,
    }

    await (admin
      .from('trending_clips')
      .update({
        candidate_flags: result.flags,
        candidate_metrics: metrics,
        candidate_checked_at: result.analyzedAt,
      } as never)
      .eq('id', clipId) as unknown as Promise<unknown>)
  } catch {
    // Non-fatal — cache miss just means re-analysis next time
  }

  return jsonResponse({ ...result, cached: false })
})
