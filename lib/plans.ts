/**
 * Plan definitions and enforcement utilities
 * Used across API routes and frontend to gate features by subscription tier.
 */

export type PlanId = 'free' | 'pro' | 'studio'

export interface PlanLimits {
  maxVideosPerMonth: number
  maxClipDurationSeconds: number
  maxUploadSizeMB: number
  watermarkForced: boolean
  customBranding: boolean
  splitScreen: boolean
  trendingDashboard: boolean
  multiPlatformPublish: boolean
  voiceOver: boolean
  apiAccess: boolean
  maxAspectRatios: number
  remakeThisLimit: number // -1 = unlimited
}

export interface PlanConfig {
  id: PlanId
  name: string
  price: number // $/month (USD)
  currency: 'USD'
  /**
   * Baseline monthly quota actually charged for.
   * Studio tier gets `bonusVideosPerMonth` on top as a welcome/value bump.
   */
  baselineVideosPerMonth: number
  bonusVideosPerMonth: number
  limits: PlanLimits
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    baselineVideosPerMonth: 3,
    bonusVideosPerMonth: 0,
    limits: {
      maxVideosPerMonth: 3,
      maxClipDurationSeconds: 60,
      maxUploadSizeMB: 200,
      watermarkForced: true,
      customBranding: false,
      splitScreen: true,
      trendingDashboard: false,
      multiPlatformPublish: false,
      voiceOver: false,
      apiAccess: false,
      maxAspectRatios: 1,
      remakeThisLimit: 3,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19,
    currency: 'USD',
    baselineVideosPerMonth: 30,
    bonusVideosPerMonth: 0,
    limits: {
      maxVideosPerMonth: 30,
      maxClipDurationSeconds: 120,
      maxUploadSizeMB: 500,
      watermarkForced: false,
      customBranding: true,
      splitScreen: true,
      trendingDashboard: true,
      multiPlatformPublish: false,
      voiceOver: false,
      apiAccess: false,
      maxAspectRatios: 3,
      remakeThisLimit: -1,
    },
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    price: 24,
    currency: 'USD',
    baselineVideosPerMonth: 90,
    bonusVideosPerMonth: 30, // welcome bonus → effective cap of 120/mois
    limits: {
      maxVideosPerMonth: 120, // 90 baseline + 30 bonus
      maxClipDurationSeconds: 120,
      maxUploadSizeMB: 500,
      watermarkForced: false,
      customBranding: true,
      splitScreen: true,
      trendingDashboard: true,
      multiPlatformPublish: true,
      voiceOver: true,
      apiAccess: true,
      maxAspectRatios: -1,
      remakeThisLimit: -1,
    },
  },
}

export function getPlanConfig(planId: string | null | undefined): PlanConfig {
  if (planId && planId in PLANS) return PLANS[planId as PlanId]
  return PLANS.free
}

export interface UsageCheckResult {
  allowed: boolean
  reason?: string
  currentUsage?: number
  limit?: number
  plan: PlanId
}

/**
 * Check if a user can create a new video based on their plan limits.
 */
export function checkVideoLimit(
  plan: string | null | undefined,
  monthlyVideosUsed: number | null
): UsageCheckResult {
  const config = getPlanConfig(plan)
  const used = monthlyVideosUsed ?? 0
  const limit = config.limits.maxVideosPerMonth

  if (limit === -1) {
    return { allowed: true, currentUsage: used, limit: -1, plan: config.id }
  }

  if (used >= limit) {
    return {
      allowed: false,
      reason: `Limite atteinte : ${used}/${limit} vidéos ce mois-ci. Passez au plan ${config.id === 'free' ? 'Pro' : 'Studio'} pour continuer.`,
      currentUsage: used,
      limit,
      plan: config.id,
    }
  }

  return { allowed: true, currentUsage: used, limit, plan: config.id }
}

/**
 * Check if the requested clip duration is allowed on the user's plan.
 * Called by the render API before kicking off an FFmpeg job — this is the
 * real cost gate (Whisper bills by the minute of audio).
 */
export function checkClipDuration(
  plan: string | null | undefined,
  durationSeconds: number,
): UsageCheckResult {
  const config = getPlanConfig(plan)
  const limit = config.limits.maxClipDurationSeconds

  // -1 would mean unlimited, but we cap everything at 120s now
  if (limit === -1) {
    return { allowed: true, currentUsage: durationSeconds, limit: -1, plan: config.id }
  }

  if (durationSeconds > limit) {
    const planLabel = config.id === 'free' ? 'Pro' : 'Studio'
    return {
      allowed: false,
      reason: `Ce clip fait ${Math.round(durationSeconds)}s, la limite de ton plan ${config.name} est de ${limit}s. Passe au plan ${planLabel} ou raccourcis le clip.`,
      currentUsage: durationSeconds,
      limit,
      plan: config.id,
    }
  }

  return { allowed: true, currentUsage: durationSeconds, limit, plan: config.id }
}

/**
 * Check if a feature is available on the user's plan.
 */
export function checkFeatureAccess(
  plan: string | null | undefined,
  feature: keyof PlanLimits
): { allowed: boolean; requiredPlan: PlanId | null } {
  const config = getPlanConfig(plan)
  const value = config.limits[feature]

  // Boolean features
  if (typeof value === 'boolean') {
    if (value) return { allowed: true, requiredPlan: null }

    // Find the minimum plan that has this feature
    const planOrder: PlanId[] = ['free', 'pro', 'studio']
    for (const pid of planOrder) {
      if (PLANS[pid].limits[feature] === true) {
        return { allowed: false, requiredPlan: pid }
      }
    }
    return { allowed: false, requiredPlan: 'studio' }
  }

  // Numeric features (-1 = unlimited, anything positive = has access)
  if (typeof value === 'number') {
    return { allowed: value !== 0, requiredPlan: null }
  }

  return { allowed: true, requiredPlan: null }
}
