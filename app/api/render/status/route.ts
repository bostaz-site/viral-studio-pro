import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { releaseJob } from '@/lib/render-queue'
import { processAndDispatchNext } from '@/lib/api/dispatch-render'
import { redis } from '@/lib/upstash'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

interface RenderJob {
  id: string
  clip_id: string
  source: string
  status: string
  storage_path: string | null
  error_message: string | null
  debug_log: string | null
  quality_tier: string | null
  contract: { feature: string; requested: boolean; applied: boolean; reason?: string }[] | null
  created_at: string
  updated_at: string
}

// ── Pipeline stage extraction from debug_log ──
// Ordered from last (most advanced) to first so we find the *latest* reached stage.
const STAGE_MARKERS: { marker: RegExp; stage: string }[] = [
  { marker: /^OUTPUT:/m,           stage: 'finalizing' },
  { marker: /^RENDER START:/m,     stage: 'encoding' },
  { marker: /^VOICEOVER/m,         stage: 'voiceover' },
  { marker: /^AUTO-CUT/m,          stage: 'cutting' },
  { marker: /^(LAYOUT DETECTION|CROP ADVISOR|FACE TRACKING)/m, stage: 'analyzing' },
  { marker: /^CAPTIONS/m,          stage: 'captions' },
  { marker: /^WHISPER/m,           stage: 'transcribing' },
  { marker: /^DOWNLOAD/m,          stage: 'downloading' },
]

function extractStage(debugLog: string | null): string | null {
  if (!debugLog) return null
  for (const { marker, stage } of STAGE_MARKERS) {
    if (marker.test(debugLog)) return stage
  }
  return null
}

export const GET = withAuth(async (request: NextRequest, user) => {
  const rl = await rateLimit(`status:${user.id}`, RATE_LIMITS.status.limit, RATE_LIMITS.status.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId')
  const clipIdParam = request.nextUrl.searchParams.get('clip_id')

  if (!jobId && !clipIdParam) {
    return NextResponse.json(
      { data: null, error: 'Missing jobId or clip_id', message: 'jobId ou clip_id requis' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  let job: RenderJob | null = null

  if (jobId) {
    const { data } = await admin
      .from('render_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single() as { data: RenderJob | null; error: unknown }
    job = data
  } else {
    // clip_id mode: return the latest done/degraded job for this clip (server-side kill switch)
    const { data } = await admin
      .from('render_jobs')
      .select('*')
      .eq('clip_id', clipIdParam!)
      .eq('user_id', user.id)
      .in('status', ['done', 'degraded'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: RenderJob | null; error: unknown }
    job = data
  }

  if (!job) {
    return NextResponse.json(
      { data: null, error: 'Job not found', message: 'Job introuvable' },
      { status: 404 }
    )
  }

  // Queue position: only check for queued jobs, NOT rendering (avoids 2.5s
  // blocking VPS call on every poll that was delaying done detection).
  let queuePosition: number | null = null
  if (job.status === 'queued') {
    try {
      const vpsUrl = process.env.VPS_RENDER_URL
      if (vpsUrl) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 1500)
        const res = await fetch(
          `${vpsUrl.replace(/\/$/, '')}/api/health/queue?jobId=${encodeURIComponent(job.id)}`,
          { signal: controller.signal, cache: 'no-store' },
        )
        clearTimeout(timer)
        if (res.ok) {
          const json = (await res.json()) as { jobPosition: number | null }
          queuePosition = json.jobPosition
        }
      }
    } catch {
      // Swallow — queue position is a nice-to-have.
    }
  }

  if (['done', 'degraded', 'error', 'failed', 'canceled', 'expired'].includes(job.status)) {
    // Job finished — release slot (idempotent) and dispatch next queued render
    releaseJob(job.id).then(() => processAndDispatchNext(admin)).catch(() => {})

    // Increment export_count on trending clip (idempotent: only once per job)
    if ((job.status === 'done' || job.status === 'degraded') && job.source === 'trending') {
      redis.set(`export_counted:${job.id}`, '1', { nx: true, ex: 86400 })
        .then(async (result) => {
          if (result === 'OK') {
            await (admin.rpc as CallableFunction)('increment_export_count', { p_clip_id: job.clip_id })
            // Emit broadcast for ExportTicker (social proof)
            try {
              const { data: tc } = await admin
                .from('trending_clips')
                .select('velocity_score, tier, platform')
                .eq('id', job.clip_id)
                .single()
              if (tc) {
                admin.channel('export-feed').send({
                  type: 'broadcast',
                  event: 'new_export',
                  payload: {
                    score: tc.velocity_score,
                    rank: tc.tier ?? 'normal',
                    platform: tc.platform ?? 'twitch',
                    timestamp: new Date().toISOString(),
                  },
                }).catch(() => {})
              }
            } catch { /* non-critical */ }
          }
        })
        .catch(() => {})
    }
  }

  // If done, generate a signed URL for download AND a public URL for preview
  let downloadUrl: string | null = null
  let publicUrl: string | null = null
  let thumbnailUrl: string | null = null
  if ((job.status === 'done' || job.status === 'degraded') && job.storage_path) {
    const { data: signedData } = await admin.storage
      .from('clips')
      .createSignedUrl(job.storage_path, 14400) // 4 hours

    downloadUrl = signedData?.signedUrl ?? null

    // Also get public URL (clips bucket is public) — used for live preview replacement
    const { data: pubData } = admin.storage
      .from('clips')
      .getPublicUrl(job.storage_path)
    publicUrl = pubData?.publicUrl ?? null

    // Get thumbnail URL (extracted from rendered output) — used as poster frame while video loads
    const thumbPath = job.storage_path.replace(/\.mp4$/, '_thumb.png')
    const { data: thumbData } = admin.storage
      .from('thumbnails')
      .getPublicUrl(thumbPath)
    thumbnailUrl = thumbData?.publicUrl ?? null
  }

  // Contextual message that reflects queue position when available
  let message: string
  if (job.status === 'degraded') {
    // Extract missing features from contract for user-facing message
    const contract = job.contract as { feature: string; requested: boolean; applied: boolean }[] | null
    const missing = contract?.filter(e => e.requested && !e.applied).map(e => e.feature.replace(/_/g, ' ')) ?? []
    message = missing.length > 0
      ? `Rendered without ${missing.join(', ')} — credit refunded`
      : 'Render complete (some features unavailable) — credit refunded'
  } else if (job.status === 'done') {
    message = 'Render complete!'
  } else if (job.status === 'failed') {
    message = `Failed after retries: ${job.error_message}`
  } else if (job.status === 'canceled') {
    message = 'Render canceled'
  } else if (job.status === 'expired') {
    message = 'Clip expired — remix again to download'
  } else if (job.status === 'error') {
    message = `Error: ${job.error_message}`
  } else if (queuePosition !== null && queuePosition > 0) {
    message = `In queue — position ${queuePosition}`
  } else if (job.status === 'rendering') {
    message = 'Rendering...'
  } else {
    message = 'Waiting...'
  }

  // Reduced quality warning
  const qualityTier = job.quality_tier ?? null
  const reducedQuality = qualityTier !== null && qualityTier !== 'HIGH_60' && qualityTier !== 'HIGH_30'

  return NextResponse.json({
    data: {
      jobId: job.id,
      status: job.status,
      storagePath: job.storage_path,
      downloadUrl,
      publicUrl,
      thumbnailUrl,
      errorMessage: job.error_message,
      qualityTier,
      reducedQuality,
      queuePosition,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      contract: job.contract ?? null,
      // Current pipeline stage (extracted from debug_log markers written by VPS every 10s)
      stage: job.status === 'rendering' ? extractStage(job.debug_log) : null,
      // Server timestamp for latency measurement: when the job reached terminal state
      serverDoneAt: ['done', 'degraded', 'failed', 'error'].includes(job.status) ? job.updated_at : null,
    },
    error: null,
    message,
  })
})
