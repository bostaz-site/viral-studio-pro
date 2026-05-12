import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWebhookEvent } from '@/lib/admin/webhooks/process-event'

// GET /api/admin/webhooks/health — list recent webhooks
export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || ''
  const provider = url.searchParams.get('provider') || ''
  const eventType = url.searchParams.get('event_type') || ''
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 100

  const admin = createAdminClient()

  let query = admin
    .from('webhook_events')
    .select('id, provider, event_id, event_type, received_at, processed_at, processing_status, error_message, retry_count', { count: 'exact' })
    .order('received_at', { ascending: false })

  if (status) query = query.eq('processing_status', status)
  if (provider) query = query.eq('provider', provider)
  if (eventType) query = query.eq('event_type', eventType)

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data, error, count } = await query

  if (error) return errorResponse('Failed to load webhooks', 500)

  // Stats queries
  const { count: totalCount } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })

  const { count: failedCount } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'failed')

  const { count: completedCount } = await admin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('processing_status', 'completed')

  return jsonResponse({
    webhooks: data || [],
    total: count || 0,
    page,
    hasMore: (data?.length || 0) === limit,
    stats: {
      total: totalCount || 0,
      completed: completedCount || 0,
      failed: failedCount || 0,
    },
  })
})

// POST /api/admin/webhooks/health — retry a failed webhook
export const POST = withAdmin(async (req: NextRequest) => {
  const { webhookId } = await req.json()
  if (!webhookId) return errorResponse('webhookId required')

  const admin = createAdminClient()

  const { data: webhook, error } = await admin
    .from('webhook_events')
    .select('*')
    .eq('id', webhookId)
    .single()

  if (error || !webhook) return errorResponse('Webhook not found', 404)
  if (webhook.processing_status !== 'failed') {
    return errorResponse('Only failed webhooks can be retried')
  }

  // Mark as processing
  await admin
    .from('webhook_events')
    .update({
      processing_status: 'processing',
      error_message: null,
      retry_count: (webhook.retry_count || 0) + 1,
    })
    .eq('id', webhookId)

  try {
    await processWebhookEvent(
      admin,
      webhookId,
      webhook.provider,
      webhook.event_type,
      webhook.payload as Record<string, unknown>
    )
    await admin
      .from('webhook_events')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookId)

    return jsonResponse({ ok: true, status: 'completed' })
  } catch (err) {
    await admin
      .from('webhook_events')
      .update({
        processing_status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq('id', webhookId)

    return errorResponse('Retry failed: ' + (err instanceof Error ? err.message : String(err)), 500)
  }
})
