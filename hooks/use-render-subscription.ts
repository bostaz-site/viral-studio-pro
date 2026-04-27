'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface RenderUpdate {
  status: string
  storage_path: string | null
  error_message: string | null
  updated_at: string
}

interface UseRenderSubscriptionOptions {
  jobId: string | null
  clipId: string
  onDone: (data: { storagePath: string }) => void
  onError: (message: string) => void
  onProgress: (status: string, queuePosition?: number | null) => void
}

/** Adaptive backoff: faster early, slower as render drags on */
const getPollingInterval = (elapsedMs: number): number => {
  if (elapsedMs < 30_000) return 3_000
  if (elapsedMs < 120_000) return 5_000
  if (elapsedMs < 300_000) return 10_000
  return 30_000
}

export function useRenderSubscription({
  jobId,
  clipId,
  onDone,
  onError,
  onProgress,
}: UseRenderSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(0)
  const doneRef = useRef(false)
  const [connected, setConnected] = useState(false)

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!jobId) return
    doneRef.current = false
    startTimeRef.current = Date.now()

    const supabase = createClient()

    // ── Realtime subscription (primary) ──
    const channel = supabase
      .channel(`render-job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'render_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (doneRef.current) return
          const row = payload.new as RenderUpdate

          if (row.status === 'done' && row.storage_path) {
            doneRef.current = true
            clearPolling()
            onDone({ storagePath: row.storage_path })
          } else if (row.status === 'error' || row.status === 'failed' || row.status === 'cancelled') {
            doneRef.current = true
            clearPolling()
            onError(row.error_message ?? 'Unknown error')
          } else if (row.status === 'rendering') {
            onProgress('rendering')
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    // ── Polling fallback with adaptive backoff ──
    const poll = async () => {
      if (doneRef.current) return
      try {
        const res = await fetch(`/api/render/status?jobId=${encodeURIComponent(jobId)}`)
        if (!res.ok || doneRef.current) return
        const json = await res.json()
        const d = json.data
        if (!d || doneRef.current) return

        if (d.status === 'done' && d.storagePath) {
          doneRef.current = true
          clearPolling()
          onDone({ storagePath: d.storagePath })
          return
        }
        if (d.status === 'error' || d.status === 'failed' || d.status === 'cancelled') {
          doneRef.current = true
          clearPolling()
          onError(d.errorMessage ?? 'Unknown error')
          return
        }
        onProgress(d.status, d.queuePosition)
      } catch {
        // Swallow — Realtime is the primary channel
      }

      if (!doneRef.current) {
        const elapsed = Date.now() - startTimeRef.current
        pollTimerRef.current = setTimeout(poll, getPollingInterval(elapsed))
      }
    }

    // First poll after initial interval
    pollTimerRef.current = setTimeout(poll, 3_000)

    return () => {
      doneRef.current = true
      channel.unsubscribe()
      channelRef.current = null
      clearPolling()
      setConnected(false)
    }
    // clipId is included so we re-subscribe if the clip changes
  }, [jobId, clipId, onDone, onError, onProgress, clearPolling])

  return { connected }
}
