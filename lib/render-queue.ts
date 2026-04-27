/**
 * API-side render queue using Upstash Redis.
 *
 * Limits concurrency of renders sent to the VPS. When the VPS is at capacity,
 * jobs are queued and processed FIFO as active jobs complete.
 *
 * Keys:
 * - `render:active_jobs`          — Set of job IDs currently being processed by the VPS
 * - `render:started:{jobId}`      — per-job TTL key (900s) to detect orphaned jobs
 * - `render:queue`                — list of job IDs waiting to be sent to the VPS
 * - `render:payload:{jobId}`      — serialized render payload (TTL 1h)
 */

import { redis } from '@/lib/upstash'

const MAX_CONCURRENT = parseInt(process.env.RENDER_MAX_CONCURRENT ?? '3', 10)
const QUEUE_MAX_SIZE = 50
const PAYLOAD_TTL = 3600 // 1 hour
const ACTIVE_JOB_TTL = 900 // 15 minutes — safety net for orphaned jobs

export interface EnqueueResult {
  accepted: boolean
  position: number | null // null = started immediately, N = position in queue
  reason?: string
}

/**
 * Try to enqueue a render job. Returns whether the job can proceed immediately
 * or was queued for later processing.
 */
export async function enqueueRender(
  jobId: string,
  payload: Record<string, unknown>,
): Promise<EnqueueResult> {
  // Check queue size first — reject if full
  const queueLen = await redis.llen('render:queue')
  if (queueLen >= QUEUE_MAX_SIZE) {
    return { accepted: false, position: null, reason: 'Queue full — try again later' }
  }

  // Store payload upfront so it's available for retries regardless of immediate/queued path
  await redis.set(`render:payload:${jobId}`, JSON.stringify(payload), { ex: PAYLOAD_TTL })

  // Try to claim a slot
  const activeCount = await redis.scard('render:active_jobs')

  if (activeCount < MAX_CONCURRENT) {
    // Slot available — render immediately
    await redis.sadd('render:active_jobs', jobId)
    await redis.set(`render:started:${jobId}`, '1', { ex: ACTIVE_JOB_TTL })
    return { accepted: true, position: null }
  }

  // No slot — queue the job
  await redis.rpush('render:queue', jobId)

  const position = await redis.llen('render:queue')
  return { accepted: true, position }
}

/**
 * Remove a finished/failed/cancelled job from the active set.
 * Idempotent — safe to call multiple times for the same job.
 */
export async function releaseJob(jobId: string): Promise<void> {
  await Promise.all([
    redis.srem('render:active_jobs', jobId),
    redis.del(`render:started:${jobId}`),
  ])
}

/**
 * Try to dispatch the next queued job into a free slot.
 * Does NOT release any job — callers must call releaseJob() first if applicable.
 *
 * Returns the next job's {jobId, payload} or null if queue is empty or no slot available.
 */
export async function processNextInQueue(): Promise<{
  jobId: string
  payload: Record<string, unknown>
} | null> {
  // Check if there's a free slot
  const activeCount = await redis.scard('render:active_jobs')
  if (activeCount >= MAX_CONCURRENT) return null

  // Pop next job from queue
  const nextJobId = await redis.lpop<string>('render:queue')
  if (!nextJobId) return null

  // Retrieve stored payload
  const raw = await redis.get<string>(`render:payload:${nextJobId}`)
  if (!raw) return null

  // Claim a slot for this job
  await redis.sadd('render:active_jobs', nextJobId)
  await redis.set(`render:started:${nextJobId}`, '1', { ex: ACTIVE_JOB_TTL })

  // Clean up stored payload
  await redis.del(`render:payload:${nextJobId}`)

  return { jobId: nextJobId, payload: JSON.parse(raw) as Record<string, unknown> }
}

/**
 * Get current queue status (for monitoring/status endpoint).
 */
export async function getQueueStatus(): Promise<{
  active: number
  queued: number
  maxConcurrent: number
}> {
  const [active, queued] = await Promise.all([
    redis.scard('render:active_jobs'),
    redis.llen('render:queue'),
  ])

  return {
    active,
    queued,
    maxConcurrent: MAX_CONCURRENT,
  }
}
