import { describe, it, expect } from 'vitest'
import {
  checkVideoLimit,
  getPlanConfig,
  checkFeatureAccess,
  checkClipDuration,
  isStudioLaunchActive,
  STUDIO_LAUNCH_ENDS_AT,
} from '@/lib/plans'

describe('Plan enforcement', () => {
  it('free plan allows 3 videos', () => {
    const result = checkVideoLimit('free', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(3)
  })

  it('free plan blocks at 3 videos', () => {
    const result = checkVideoLimit('free', 3)
    expect(result.allowed).toBe(false)
  })

  it('pro plan allows 30 videos', () => {
    const result = checkVideoLimit('pro', 29)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(30)
  })

  it('pro plan blocks at 30 videos', () => {
    const result = checkVideoLimit('pro', 30)
    expect(result.allowed).toBe(false)
  })

  it('studio plan allows 120 videos (90 baseline + 30 bonus)', () => {
    const result = checkVideoLimit('studio', 119)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(120)
  })

  it('studio plan blocks at 120 videos (soft cap to protect margins)', () => {
    const result = checkVideoLimit('studio', 120)
    expect(result.allowed).toBe(false)
  })

  it('studio plan exposes baseline + bonus breakdown', () => {
    const config = getPlanConfig('studio')
    expect(config.baselineVideosPerMonth).toBe(90)
    expect(config.bonusVideosPerMonth).toBe(30)
    expect(config.limits.maxVideosPerMonth).toBe(120)
  })

  it('pro plan is $19 USD', () => {
    const config = getPlanConfig('pro')
    expect(config.price).toBe(19)
    expect(config.currency).toBe('USD')
  })

  it('studio plan is $24 USD (prix de lancement, regular $29)', () => {
    const config = getPlanConfig('studio')
    expect(config.price).toBe(24)
    expect(config.priceRegular).toBe(29)
    expect(config.currency).toBe('USD')
  })

  it('pro plan has no priceRegular (no promo)', () => {
    const config = getPlanConfig('pro')
    expect(config.priceRegular).toBeUndefined()
  })

  // ─── Studio launch price countdown ──────────────────────────────────────

  it('isStudioLaunchActive is true 1ms before end date', () => {
    const justBefore = new Date(STUDIO_LAUNCH_ENDS_AT.getTime() - 1)
    expect(isStudioLaunchActive(justBefore)).toBe(true)
  })

  it('isStudioLaunchActive is false at exact end date', () => {
    expect(isStudioLaunchActive(STUDIO_LAUNCH_ENDS_AT)).toBe(false)
  })

  it('isStudioLaunchActive is false 1 day after end date', () => {
    const dayAfter = new Date(STUDIO_LAUNCH_ENDS_AT.getTime() + 86_400_000)
    expect(isStudioLaunchActive(dayAfter)).toBe(false)
  })

  it('unknown plan defaults to free', () => {
    const config = getPlanConfig('nonexistent')
    expect(config.limits.maxVideosPerMonth).toBe(3)
    expect(config.limits.watermarkForced).toBe(true)
  })

  it('null plan defaults to free', () => {
    const config = getPlanConfig(null)
    expect(config.limits.maxVideosPerMonth).toBe(3)
  })

  // Split-screen is the core differentiator — available on ALL plans (the
  // marketing promise) including Free. Higher tiers just get more quota.
  it('free plan can access split-screen', () => {
    const result = checkFeatureAccess('free', 'splitScreen')
    expect(result.allowed).toBe(true)
  })

  it('pro plan can access split-screen', () => {
    const result = checkFeatureAccess('pro', 'splitScreen')
    expect(result.allowed).toBe(true)
  })

  it('studio plan can access split-screen', () => {
    const result = checkFeatureAccess('studio', 'splitScreen')
    expect(result.allowed).toBe(true)
  })

  // ─── Clip duration cap (Whisper cost gate) ────────────────────────────────

  it('free plan allows 60s clips', () => {
    expect(checkClipDuration('free', 60).allowed).toBe(true)
  })

  it('free plan blocks 61s clips', () => {
    const result = checkClipDuration('free', 61)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Pro')
  })

  it('pro plan allows 120s clips', () => {
    expect(checkClipDuration('pro', 120).allowed).toBe(true)
  })

  it('pro plan blocks 121s clips', () => {
    const result = checkClipDuration('pro', 121)
    expect(result.allowed).toBe(false)
  })

  it('studio plan blocks 121s clips (same 2min cap as pro)', () => {
    const result = checkClipDuration('studio', 121)
    expect(result.allowed).toBe(false)
  })
})
