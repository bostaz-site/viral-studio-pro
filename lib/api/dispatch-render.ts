/**
 * Unified queue dispatch — pops the next queued render job and sends it to the VPS.
 *
 * This is the ONLY correct way to process queued jobs. Never call
 * processNextInQueue() without dispatching the result to the VPS.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { processNextInQueue } from '@/lib/render-queue'
import { dispatchToVps } from '@/lib/api/render-helpers'

export async function processAndDispatchNext(
  admin: SupabaseClient,
): Promise<boolean> {
  const next = await processNextInQueue()
  if (!next) return false

  // Look up userId for refund-on-failure (sendToVps handles this internally)
  const { data: jobRow } = await admin
    .from('render_jobs')
    .select('user_id')
    .eq('id', next.jobId)
    .single()

  const userId = (jobRow?.user_id as string) ?? ''

  // Update DB status from queued → pending
  await admin.from('render_jobs')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', next.jobId)

  // Dispatch to VPS — held ~2.5s so the request leaves the serverless runtime.
  // Payload stays in Redis until job reaches terminal state (done/failed) — needed for retries
  await dispatchToVps(admin, next.jobId, userId, next.payload, 'queue-dispatch')

  return true
}
