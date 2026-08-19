import * as Sentry from '@sentry/nextjs'

// ── Noise filter: browser errors we can't act on ──────────────────────────
const IGNORED_ERRORS = [
  // Browser extensions injecting scripts
  /extensions\//i,
  /moz-extension:\/\//,
  /chrome-extension:\/\//,
  // ResizeObserver floods (benign, fired by CSS transitions)
  /ResizeObserver loop/,
  // Network cancellations (user navigated away)
  /AbortError/,
  /fetch.*aborted/i,
  /signal.*aborted/i,
  /The operation was aborted/,
  // Safari-specific noise
  /Load failed/,
  /cancelled/i,
  // Next.js hydration mismatches (cosmetic in dark mode)
  /Hydration failed/,
  /Text content does not match/,
]

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],

  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? ''
    if (IGNORED_ERRORS.some(re => re.test(msg))) return null

    // Strip PII — keep user ID only (set via setUser), never email
    if (event.user?.email) delete event.user.email
    if (event.user?.username) delete event.user.username

    return event
  },
})
