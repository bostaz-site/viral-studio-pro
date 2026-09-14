import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET  /api/admin/inbox/onboarding-drafts — list welcome drafts pending approval
 * PATCH /api/admin/inbox/onboarding-drafts — send or skip a draft { id, action: 'send'|'skip' }
 */
export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('email_messages')
    .select('id, influencer_id, subject, body_text, template_name, status, created_at')
    .eq('status', 'draft')
    .eq('direction', 'outbound')
    .eq('template_name', 'cold-v1-welcome')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return errorResponse(error.message, 500)

  const messages = (data ?? []) as Array<Record<string, unknown>>
  if (messages.length > 0) {
    const ids = [...new Set(messages.map(m => m.influencer_id).filter(Boolean))] as string[]
    if (ids.length > 0) {
      const { data: infs } = await admin
        .from('influencers')
        .select('id, display_name, email, platform_handle')
        .in('id', ids)

      const infMap = new Map((infs ?? []).map((i: Record<string, unknown>) => [i.id, i]))
      for (const msg of messages) {
        const inf = infMap.get(msg.influencer_id as string) as Record<string, unknown> | undefined
        msg.influencer_name = inf?.display_name ?? inf?.platform_handle ?? inf?.email ?? 'Unknown'
      }
    }
  }

  return jsonResponse({ drafts: messages, count: messages.length })
})

export const PATCH = withAdmin(async (req) => {
  const body = await req.json() as { id?: string; action?: string }
  if (!body.id || !body.action || !['send', 'skip'].includes(body.action)) {
    return errorResponse('id and action (send|skip) required', 400)
  }

  const admin = createAdminClient()

  if (body.action === 'skip') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('email_messages')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .eq('id', body.id)
    return jsonResponse({ status: 'skipped' })
  }

  // Send: mark as sent + update influencer → demo_sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg } = await (admin as any)
    .from('email_messages')
    .select('influencer_id')
    .eq('id', body.id)
    .single() as { data: { influencer_id: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('email_messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', body.id)

  if (msg?.influencer_id) {
    await admin.from('influencers').update({ status: 'demo_sent' } as never).eq('id', msg.influencer_id)
  }

  return jsonResponse({ status: 'sent' })
})
