import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { withAuth } from '@/lib/api/withAuth'
import { isAdminUser } from '@/lib/admin/is-admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/sentry/test — Admin-only: fire a test event to verify Sentry is receiving data.
 * Returns the event ID so it can be looked up in the Sentry dashboard.
 */
export const GET = withAuth(async (_req, user) => {
  const supabase = createClient()
  const admin = await isAdminUser(supabase, user.id)
  if (!admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const eventId = Sentry.captureMessage('Sentry test event — if you see this, monitoring works', {
    level: 'info',
    tags: { test: 'true', money_path: 'false' },
    extra: { triggeredBy: user.id, timestamp: new Date().toISOString() },
  })

  await Sentry.flush(5000)

  return NextResponse.json({
    data: { eventId, dsn: process.env.SENTRY_DSN ? 'configured' : 'MISSING' },
    error: null,
    message: `Sentry test event sent — eventId: ${eventId}. Check your Sentry dashboard.`,
  })
})
