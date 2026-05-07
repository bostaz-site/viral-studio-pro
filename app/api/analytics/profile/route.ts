import { NextRequest } from 'next/server'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { computeProfileForUser } from '@/lib/analytics/pattern-detector'
import type { LearnedDistributionProfile } from '@/types/learning'

// In-memory cache: userId → { profile, ts }
const cache = new Map<string, { profile: LearnedDistributionProfile; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export const GET = withAuth(async (req: NextRequest, user) => {
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'

  if (!force) {
    const cached = cache.get(user.id)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return jsonResponse(cached.profile)
    }
  }

  try {
    const profile = await computeProfileForUser(user.id)
    cache.set(user.id, { profile, ts: Date.now() })
    return jsonResponse(profile)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to compute profile'
    return errorResponse(msg, 500)
  }
})
