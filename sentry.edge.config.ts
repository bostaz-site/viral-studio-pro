import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  beforeSend(event) {
    if (/\/api\/(stripe|render|publish)/.test(event.request?.url ?? '')) {
      event.tags = { ...event.tags, 'money_path': 'true' }
    }
    if (event.user?.email) delete event.user.email
    if (event.user?.username) delete event.user.username
    return event
  },
})
