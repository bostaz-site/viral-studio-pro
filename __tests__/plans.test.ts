import { describe, it, expect } from 'vitest'
import { checkVideoLimit, getPlanConfig, checkFeatureAccess } from '@/lib/plans'

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

  it('studio plan is unlimited (-1)', () => {
    const result = checkVideoLimit('studio', 999)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(-1)
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

  it('free plan cannot access split-screen', () => {
    const result = checkFeatureAccess('free', 'splitScreen')
    expect(result.allowed).toBe(false)
  })

  it('studio plan can access split-screen', () => {
    const result = checkFeatureAccess('studio', 'splitScreen')
    expect(result.allowed).toBe(true)
  })
})
