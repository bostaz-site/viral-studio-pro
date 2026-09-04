import { describe, it, expect } from 'vitest'
import {
  stripEngagementBait,
  stripBannedWords,
  normalizeFollowCta,
  BANNED_ENGAGEMENT_BAIT,
  BANNED_WORDS,
} from '@/lib/distribution/caption-filters'

// ── Helpers to simulate the autofarm quality gate logic ──────────────────────

interface MockContract {
  feature: string
  applied: boolean
  meta?: Record<string, unknown>
}

interface MockRenderJob {
  status: string
  transform_score: number | null
  contract: MockContract[]
  render_settings: Record<string, unknown> | null
}

/** Replicates the autofarm gate logic from publish-scheduled/route.ts */
function evaluateAutofarmGate(
  job: MockRenderJob | null,
  hasVariant: boolean
): { eligible: boolean; reason: string } {
  if (!job) return { eligible: false, reason: 'no render job' }
  if (job.status === 'degraded') return { eligible: false, reason: 'render_degraded' }

  const score = job.transform_score
  if (score !== null && score < 3) {
    return { eligible: false, reason: `transform_score=${score}/3 — autofarm requires hook + captions + smart zoom` }
  }

  if (!hasVariant) {
    return { eligible: false, reason: 'no diversify variant — autofarm requires platform-specific encoding' }
  }

  // Source watermark check
  const cropEntry = job.contract.find(e => e.feature === 'crop_mode')
  const actualMode = (cropEntry?.meta?.actual_mode as string) ?? ''
  const borderCrop = (cropEntry?.meta?.borderCropPx as number) ?? 0
  const sourcePlatform = (job.render_settings?.sourcePlatform as string) ?? ''
  const isStreamPlatform = ['twitch', 'kick'].includes(sourcePlatform)
  if (isStreamPlatform && actualMode === 'fullframe' && borderCrop < 40) {
    return { eligible: false, reason: `source watermark visible — ${sourcePlatform} fullframe with borderCrop=${borderCrop}px (<40)` }
  }

  return { eligible: true, reason: 'ok' }
}

/** Replicates the manual publish gate (warn, never block) */
function evaluateManualGate(
  job: MockRenderJob | null
): { warning: string | null } {
  if (!job || job.transform_score === null) return { warning: null }
  if (job.transform_score < 3) {
    return { warning: `Ce render a ${job.transform_score}/3 transformations — risque de visibilité réduite sur TikTok` }
  }
  return { warning: null }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Autofarm Quality Gate', () => {
  const fullJob: MockRenderJob = {
    status: 'done',
    transform_score: 3,
    contract: [
      { feature: 'hook_text', applied: true },
      { feature: 'captions', applied: true },
      { feature: 'smart_zoom', applied: true },
      { feature: 'crop_mode', applied: true, meta: { actual_mode: 'fit', borderCropPx: 50 } },
    ],
    render_settings: { sourcePlatform: 'twitch' },
  }

  it('allows 3/3 transform_score with variant', () => {
    const result = evaluateAutofarmGate(fullJob, true)
    expect(result.eligible).toBe(true)
  })

  it('blocks 2/3 transform_score for autofarm', () => {
    const job = { ...fullJob, transform_score: 2 }
    const result = evaluateAutofarmGate(job, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('transform_score=2/3')
  })

  it('blocks degraded renders', () => {
    const job = { ...fullJob, status: 'degraded' }
    const result = evaluateAutofarmGate(job, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('render_degraded')
  })

  it('blocks when no variant present', () => {
    const result = evaluateAutofarmGate(fullJob, false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('no diversify variant')
  })

  it('blocks source watermark on Kick fullframe with low borderCrop', () => {
    const job: MockRenderJob = {
      ...fullJob,
      contract: [
        ...fullJob.contract.filter(e => e.feature !== 'crop_mode'),
        { feature: 'crop_mode', applied: true, meta: { actual_mode: 'fullframe', borderCropPx: 20 } },
      ],
      render_settings: { sourcePlatform: 'kick' },
    }
    const result = evaluateAutofarmGate(job, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('source watermark visible')
    expect(result.reason).toContain('kick')
  })

  it('allows fullframe with sufficient borderCrop', () => {
    const job: MockRenderJob = {
      ...fullJob,
      contract: [
        ...fullJob.contract.filter(e => e.feature !== 'crop_mode'),
        { feature: 'crop_mode', applied: true, meta: { actual_mode: 'fullframe', borderCropPx: 50 } },
      ],
      render_settings: { sourcePlatform: 'twitch' },
    }
    const result = evaluateAutofarmGate(job, true)
    expect(result.eligible).toBe(true)
  })

  it('allows non-stream sources in fullframe without borderCrop check', () => {
    const job: MockRenderJob = {
      ...fullJob,
      contract: [
        ...fullJob.contract.filter(e => e.feature !== 'crop_mode'),
        { feature: 'crop_mode', applied: true, meta: { actual_mode: 'fullframe', borderCropPx: 0 } },
      ],
      render_settings: { sourcePlatform: 'upload' },
    }
    const result = evaluateAutofarmGate(job, true)
    expect(result.eligible).toBe(true)
  })
})

describe('Manual Publish Gate (warning only)', () => {
  it('no warning at 3/3', () => {
    const result = evaluateManualGate({
      status: 'done',
      transform_score: 3,
      contract: [],
      render_settings: null,
    })
    expect(result.warning).toBeNull()
  })

  it('warns at 2/3', () => {
    const result = evaluateManualGate({
      status: 'done',
      transform_score: 2,
      contract: [],
      render_settings: null,
    })
    expect(result.warning).toContain('2/3')
    expect(result.warning).toContain('visibilité réduite')
  })

  it('warns at 0/3', () => {
    const result = evaluateManualGate({
      status: 'done',
      transform_score: 0,
      contract: [],
      render_settings: null,
    })
    expect(result.warning).toContain('0/3')
  })

  it('no warning when score is null', () => {
    const result = evaluateManualGate({
      status: 'done',
      transform_score: null,
      contract: [],
      render_settings: null,
    })
    expect(result.warning).toBeNull()
  })
})

describe('Caption Spam Filters', () => {
  it('strips "like if" engagement bait', () => {
    const result = stripEngagementBait('Like if you agree! Great clip.')
    expect(result.toLowerCase()).not.toContain('like if')
    expect(result).toContain('Great clip')
  })

  it('strips "tag a friend"', () => {
    const result = stripEngagementBait('Tag a friend who does this. Amazing moment.')
    expect(result.toLowerCase()).not.toContain('tag a friend')
    expect(result).toContain('Amazing moment')
  })

  it('strips "comment yes"', () => {
    const result = stripEngagementBait('Comment yes if this is you.')
    expect(result.toLowerCase()).not.toContain('comment yes')
  })

  it('strips "share this with"', () => {
    const result = stripEngagementBait('Share this with your best friend. Epic play.')
    expect(result.toLowerCase()).not.toContain('share this with')
    expect(result).toContain('Epic play')
  })

  it('strips "save this"', () => {
    const result = stripEngagementBait('Save this for later. Top tier gameplay.')
    expect(result.toLowerCase()).not.toContain('save this')
    expect(result).toContain('Top tier gameplay')
  })

  it('strips banned words', () => {
    const result = stripBannedWords('This shit is fucking insane')
    expect(result.toLowerCase()).not.toContain('shit')
    expect(result.toLowerCase()).not.toContain('fucking')
  })

  it('keeps "follow for more" at end via normalizeFollowCta', () => {
    const result = normalizeFollowCta('Great clip. Follow for more!')
    expect(result).toContain('Follow for more')
  })

  it('removes "follow for more" from middle of text', () => {
    const result = normalizeFollowCta('Great play. Follow for more clips! Best moment.')
    // The mid-text occurrence should be removed
    expect(result).not.toMatch(/follow for more clips/i)
    expect(result).toContain('Great play')
    expect(result).toContain('Best moment')
  })

  it('blocklist includes all expected phrases', () => {
    const expected = ['like if', 'tag a friend', 'comment yes', 'share this with', 'save this']
    for (const phrase of expected) {
      expect(BANNED_ENGAGEMENT_BAIT).toContain(phrase)
    }
  })

  it('banned words list includes common vulgarities', () => {
    const expected = ['fuck', 'shit', 'bitch', 'nigga', 'retard']
    for (const word of expected) {
      expect(BANNED_WORDS).toContain(word)
    }
  })
})
