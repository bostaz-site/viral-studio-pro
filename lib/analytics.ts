/**
 * Privacy-first analytics client.
 *
 * Usage from any client component:
 *   import { track } from '@/lib/analytics'
 *   track('demo_clip_switch', { clip_id: 'clutch' })
 *
 * Design goals:
 * - No PII: only a random per-tab session UUID goes over the wire.
 * - Respects Do Not Track.
 * - Fire-and-forget: failures never throw or log to the user.
 * - Batched: events are queued and flushed every 800ms or on pagehide.
 */

type EventName =
  | 'page_view'
  | 'demo_view'
  | 'demo_clip_switch'
  | 'demo_caption_switch'
  | 'demo_split_toggle'
  | 'demo_cta_click'
  | 'cta_hero_click'
  | 'cta_pricing_click'
  | 'cta_signup_click'
  | 'exit_intent_shown'
  | 'exit_intent_submitted'
  | 'exit_intent_dismissed'
  | 'changelog_view'
  | 'newsletter_submitted'
  | 'pricing_view'

type Primitive = string | number | boolean

interface QueuedEvent {
  name: EventName
  session_id: string
  page_path?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  metadata?: Record<string, Primitive>
}

const SESSION_KEY = 'vsp:analytics_session'
const ENDPOINT = '/api/events'
const FLUSH_INTERVAL_MS = 800

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let listenersWired = false

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function doNotTrack(): boolean {
  if (!isBrowser()) return true
  // Standard + legacy + IE variants.
  const nav = window.navigator as Navigator & { doNotTrack?: string; msDoNotTrack?: string }
  const dnt =
    nav.doNotTrack ||
    (window as unknown as { doNotTrack?: string }).doNotTrack ||
    nav.msDoNotTrack
  return dnt === '1' || dnt === 'yes'
}

function getSessionId(): string {
  if (!isBrowser()) return 'server'
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return 'no-storage'
  }
}

function readUtm(): Pick<QueuedEvent, 'utm_source' | 'utm_medium' | 'utm_campaign'> {
  if (!isBrowser()) return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const utm_source = params.get('utm_source') ?? undefined
    const utm_medium = params.get('utm_medium') ?? undefined
    const utm_campaign = params.get('utm_campaign') ?? undefined
    return { utm_source, utm_medium, utm_campaign }
  } catch {
    return {}
  }
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_INTERVAL_MS)
}

async function flush(useBeacon = false): Promise<void> {
  if (!isBrowser() || queue.length === 0) return
  const events = queue.splice(0, queue.length)
  const body = JSON.stringify({ events })

  try {
    if (useBeacon && 'sendBeacon' in navigator) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      return
    }
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // Drop silently — analytics must never break the UI.
  }
}

function wireListeners(): void {
  if (listenersWired || !isBrowser()) return
  listenersWired = true
  // Final flush on tab close / navigation.
  window.addEventListener('pagehide', () => {
    void flush(true)
  })
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flush(true)
    }
  })
}

/**
 * Track a named event. Safe to call from anywhere in client code; no-ops on
 * the server and when Do Not Track is enabled.
 */
export function track(name: EventName, metadata?: Record<string, Primitive>): void {
  if (!isBrowser() || doNotTrack()) return
  wireListeners()

  const event: QueuedEvent = {
    name,
    session_id: getSessionId(),
    page_path: window.location.pathname,
    referrer: document.referrer || undefined,
    ...readUtm(),
    ...(metadata ? { metadata } : {}),
  }
  queue.push(event)
  scheduleFlush()
}
