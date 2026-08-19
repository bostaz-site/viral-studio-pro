import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Tag money-path errors for high-priority alerting
    const url = event.request?.url ?? ''
    if (/\/api\/(stripe|render|publish)/.test(url)) {
      event.tags = { ...event.tags, 'money_path': 'true' }
    }
    // Strip PII
    if (event.user?.email) delete event.user.email
    if (event.user?.username) delete event.user.username
    return event
  },
})
