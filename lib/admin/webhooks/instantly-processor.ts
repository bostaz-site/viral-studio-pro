import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Process the 4 critical Instantly webhook events for Week 1.
 * Other event types are stored in webhook_events but not processed yet.
 */
export async function processInstantlyEvent(
  admin: SupabaseClient,
  webhookEventId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const email = extractEmail(payload)

  // Find influencer by email (may not exist if lead was added outside our system)
  const influencer = email
    ? await findInfluencer(admin, email)
    : null

  switch (eventType) {
    case 'email_sent':
      await handleEmailSent(admin, webhookEventId, payload, email, influencer)
      break
    case 'email_replied':
      await handleEmailReplied(admin, webhookEventId, payload, email, influencer)
      break
    case 'email_bounced':
      await handleEmailBounced(admin, webhookEventId, payload, email, influencer)
      break
    case 'email_unsubscribed':
      await handleEmailUnsubscribed(admin, webhookEventId, payload, email, influencer)
      break
    default:
      // Stored in webhook_events but not processed — TODO Week 2+
      break
  }
}

// --- Helpers ---

function extractEmail(payload: Record<string, unknown>): string {
  const raw =
    (payload.email as string) ||
    (payload.to_email as string) ||
    (payload.recipient_email as string) ||
    (payload.lead_email as string) ||
    ''
  return raw.toLowerCase().trim()
}

interface Influencer {
  id: string
  status: string
  total_emails_sent: number
  total_emails_replied: number
}

async function findInfluencer(
  admin: SupabaseClient,
  email: string
): Promise<Influencer | null> {
  if (!email) return null
  const { data } = await admin
    .from('influencers')
    .select('id, status, total_emails_sent, total_emails_replied')
    .eq('email', email)
    .single()
  return data
}

function ts(payload: Record<string, unknown>): string {
  return (payload.timestamp as string) || new Date().toISOString()
}

// --- Event Handlers ---

async function handleEmailSent(
  admin: SupabaseClient,
  webhookEventId: string,
  payload: Record<string, unknown>,
  email: string,
  influencer: Influencer | null
) {
  await admin.from('email_events').insert({
    influencer_id: influencer?.id ?? null,
    event_type: 'sent',
    occurred_at: ts(payload),
    metadata: {
      email,
      subject: payload.subject,
      campaign_id: payload.campaign_id,
      from_email: payload.from_email || payload.from,
    },
    webhook_event_id: webhookEventId,
  })

  if (influencer) {
    const updates: Record<string, unknown> = {
      last_contacted_at: new Date().toISOString(),
      total_emails_sent: (influencer.total_emails_sent || 0) + 1,
      updated_at: new Date().toISOString(),
    }
    // Auto-advance cold → contacted
    if (influencer.status === 'cold' || influencer.status === 'queued') {
      updates.status = 'contacted'
      updates.status_changed_at = new Date().toISOString()
    }
    await admin.from('influencers').update(updates).eq('id', influencer.id)
  }
}

async function handleEmailReplied(
  admin: SupabaseClient,
  webhookEventId: string,
  payload: Record<string, unknown>,
  email: string,
  influencer: Influencer | null
) {
  // 1. INSERT email_messages (the reply)
  const { data: message } = await admin
    .from('email_messages')
    .insert({
      influencer_id: influencer?.id ?? null,
      direction: 'inbound',
      subject: (payload.subject as string) || null,
      body_text: (payload.body as string) || (payload.text as string) || (payload.reply_text as string) || null,
      body_html: (payload.body_html as string) || (payload.html as string) || null,
      message_id_external: (payload.message_id as string) || null,
      thread_id: (payload.thread_id as string) || (payload.conversation_id as string) || email,
      sent_at: ts(payload),
      is_read: false,
      is_archived: false,
      is_starred: false,
    })
    .select('id')
    .single()

  // 2. INSERT email_events
  await admin.from('email_events').insert({
    message_id: message?.id ?? null,
    influencer_id: influencer?.id ?? null,
    event_type: 'replied',
    occurred_at: ts(payload),
    metadata: {
      email,
      subject: payload.subject,
      from_email: payload.from_email || payload.from,
    },
    webhook_event_id: webhookEventId,
  })

  // 3. Update influencer status → replied
  if (influencer) {
    await admin
      .from('influencers')
      .update({
        status: 'replied',
        status_changed_at: new Date().toISOString(),
        total_emails_replied: (influencer.total_emails_replied || 0) + 1,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', influencer.id)
  }
}

async function handleEmailBounced(
  admin: SupabaseClient,
  webhookEventId: string,
  payload: Record<string, unknown>,
  email: string,
  influencer: Influencer | null
) {
  // 1. INSERT email_events
  await admin.from('email_events').insert({
    influencer_id: influencer?.id ?? null,
    event_type: 'bounced_hard',
    occurred_at: ts(payload),
    metadata: {
      email,
      bounce_type: payload.bounce_type || 'hard',
      bounce_reason: payload.reason || payload.bounce_reason,
    },
    webhook_event_id: webhookEventId,
  })

  // 2. Auto-add to suppression_list
  if (email) {
    await admin
      .from('suppression_list')
      .upsert(
        {
          email,
          reason: 'hard_bounce',
          source: 'instantly_webhook',
        },
        { onConflict: 'email' }
      )
  }

  // 3. Mark influencer if exists
  if (influencer) {
    await admin
      .from('influencers')
      .update({
        status: 'blocked',
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', influencer.id)
  }
}

async function handleEmailUnsubscribed(
  admin: SupabaseClient,
  webhookEventId: string,
  payload: Record<string, unknown>,
  email: string,
  influencer: Influencer | null
) {
  // 1. INSERT email_events
  await admin.from('email_events').insert({
    influencer_id: influencer?.id ?? null,
    event_type: 'unsubscribed',
    occurred_at: ts(payload),
    metadata: { email },
    webhook_event_id: webhookEventId,
  })

  // 2. Auto-add to suppression_list
  if (email) {
    await admin
      .from('suppression_list')
      .upsert(
        {
          email,
          reason: 'unsubscribe',
          source: 'instantly_webhook',
        },
        { onConflict: 'email' }
      )
  }

  // 3. Mark influencer
  if (influencer) {
    await admin
      .from('influencers')
      .update({
        unsubscribed: true,
        unsubscribed_at: new Date().toISOString(),
        status: 'declined',
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', influencer.id)
  }
}
