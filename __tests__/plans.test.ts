import { describe, it, expect } from 'vitest'
import { checkVideoLimit, getPlanConfig, checkFeatureAccess, checkClipDuration } from '@/lib/plans'

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

  it('pro plan allows 50 videos', () => {
    const result = checkVideoLimit('pro', 49)
    expect(result.allowed).toBe(true)
  })

  it('studio plan allows 300 videos', () => {
    const result = checkVideoLimit('studio', 299)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(300)
  })

  it('studio plan blocks at 300 videos (soft cap to protect margins)', () => {
    const result = checkVideoLimit('studio', 300)
    expect(result.allowed).toBe(false)
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
