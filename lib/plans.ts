/**
 * Plan definitions and enforcement utilities
 * Used across API routes and frontend to gate features by subscription tier.
 */

export type PlanId = 'free' | 'pro' | 'studio'

/**
 * When the Studio "Prix de lancement" ($24 instead of $29) expires.
 * Past this date, isStudioLaunchActive() returns false and the UI
 * should stop showing the crossed-out $29 + countdown.
 *
 * When this date passes, Samy should either:
 * 1. Update lib/plans.ts studio price to 29 and remove priceRegular, OR
 * 2. Extend STUDIO_LAUNCH_ENDS_AT to keep the promo running.
 */
export const STUDIO_LAUNCH_ENDS_AT = new Date('2026-05-10T23:59:59Z')

export function isStudioLaunchActive(now: Date = new Date()): boolean {
  return now.getTime() < STUDIO_LAUNCH_ENDS_AT.getTime()
}

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
  price: number // $/month (USD) — what the user actually pays
  /**
   * Regular (pre-promo) price used for strikethrough display.
   * When `priceRegular > price`, the UI shows the higher price crossed out
   * next to the current (launch/promo) price.
   */
  priceRegular?: number
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
    price: 24, // prix de lancement
    priceRegular: 29,
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
      reason: `Monthly limit reached: ${used}/${limit} videos this month. Upgrade to ${config.id === 'free' ? 'Pro' : 'Studio'} to continue.`,
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
      reason: `This clip is ${Math.round(durationSeconds)}s, but your ${config.name} plan's limit is ${limit}s. Upgrade to ${planLabel} or shorten the clip.`,
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
