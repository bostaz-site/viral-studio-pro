/**
 * Client-side event tracker for the Repost Kit.
 * Batches events and flushes every 5s or immediately on critical events.
 */

const CRITICAL_EVENTS = new Set([
  'download_hd_clicked',
  'download_mobile_clicked',
  'caption_copied',
  'code_copied',
  'post_url_submitted',
])

interface QueuedEvent {
  event_type: string
  metadata?: Record<string, unknown>
  occurred_at: string
}

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let currentSessionId: string | null = null

export function initTracker(sessionId: string) {
  currentSessionId = sessionId
  if (flushTimer) clearInterval(flushTimer)
  flushTimer = setInterval(flush, 5000)

  // Flush on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }
}

export function trackEvent(eventType: string, metadata?: Record<string, unknown>) {
  queue.push({
    event_type: eventType,
    metadata,
    occurred_at: new Date().toISOString(),
  })

  if (CRITICAL_EVENTS.has(eventType)) {
    flush()
  }
}

function flush() {
  if (!currentSessionId || queue.length === 0) return

  const events = [...queue]
  queue = []

  // Use sendBeacon for reliability on unload, fetch otherwise
  const body = JSON.stringify({ sessionId: currentSessionId, events })

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/partner/repost/events', body)
  } else {
    fetch('/api/partner/repost/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }
}

export function destroyTracker() {
  flush()
  if (flushTimer) clearInterval(flushTimer)
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', flush)
  }
}
