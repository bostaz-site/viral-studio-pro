import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Statuses that must NEVER be overwritten by automated webhook events.
 * Once an influencer reaches these stages, only manual admin action can change status.
 */
const PROTECTED_STATUSES = new Set([
  'interested', 'demo_sent', 'evaluating', 'onboarded', 'active', 'paying', 'declined', 'blocked',
])

/** Statuses that are safe to auto-advance to 'replied' */
const REPLY_SAFE_STATUSES = new Set(['unqualified', 'cold', 'queued', 'contacted', 'opened'])

/** Statuses that are safe to auto-advance to 'contacted' */
const SENT_SAFE_STATUSES = new Set(['cold', 'queued'])

/** Statuses that are safe to auto-set on bounce/unsub (early pipeline statuses) */
const EARLY_STATUSES = new Set(['unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied'])

/**
 * Process the 4 critical Instantly webhook events.
 * Other event types are stored in webhook_events but not processed yet.
 */
export async function processInstantlyEvent(
  admin: SupabaseClient,
  webhookEventId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const email = extractEmail(payload)

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
  platform_handle: string | null
  platform_url: string | null
  primary_platform: string | null
}

async function findInfluencer(
  admin: SupabaseClient,
  email: string
): Promise<Influencer | null> {
  if (!email) return null
  const { data } = await admin
    .from('influencers')
    .select('id, status, total_emails_sent, total_emails_replied, platform_handle, platform_url, primary_platform')
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
    // Auto-advance cold/queued → contacted (only from safe statuses)
    if (SENT_SAFE_STATUSES.has(influencer.status)) {
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
  // 1. Always INSERT email_messages (timeline must keep everything)
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

  // 2. Always INSERT email_events
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

  // 3. Update influencer — always increment counters, but only change status from safe statuses
  if (influencer) {
    const updates: Record<string, unknown> = {
      total_emails_replied: (influencer.total_emails_replied || 0) + 1,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (REPLY_SAFE_STATUSES.has(influencer.status)) {
      updates.status = 'replied'
      updates.status_changed_at = new Date().toISOString()
    }
    // If status is protected, counters still update but status stays untouched

    await admin.from('influencers').update(updates).eq('id', influencer.id)
  }
}

async function handleEmailBounced(
  admin: SupabaseClient,
  webhookEventId: string,
  payload: Record<string, unknown>,
  email: string,
  influencer: Influencer | null
) {
  // 1. Always INSERT email_events
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

  // 2. Suppression is UNCONDITIONAL (compliance — always block the email)
  if (email) {
    const domain = email.split('@')[1] || null
    await admin
      .from('suppression_list')
      .upsert(
        {
          email,
          email_domain: domain,
          reason: 'hard_bounce',
          source: 'instantly_webhook',
          platform_handle: influencer?.platform_handle ?? null,
          profile_url: influencer?.platform_url ?? null,
          platform: influencer?.primary_platform ?? null,
        },
        { onConflict: 'email' }
      )
  }

  // 3. Status → blocked only from early statuses (active partner with bounced email stays active)
  if (influencer && EARLY_STATUSES.has(influencer.status)) {
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
  // 1. Always INSERT email_events
  await admin.from('email_events').insert({
    influencer_id: influencer?.id ?? null,
    event_type: 'unsubscribed',
    occurred_at: ts(payload),
    metadata: { email },
    webhook_event_id: webhookEventId,
  })

  // 2. Suppression is UNCONDITIONAL (compliance)
  if (email) {
    const domain = email.split('@')[1] || null
    await admin
      .from('suppression_list')
      .upsert(
        {
          email,
          email_domain: domain,
          reason: 'unsubscribe',
          source: 'instantly_webhook',
          platform_handle: influencer?.platform_handle ?? null,
          profile_url: influencer?.platform_url ?? null,
          platform: influencer?.primary_platform ?? null,
        },
        { onConflict: 'email' }
      )
  }

  // 3. Always mark unsubscribed flag, but status → declined only from early statuses
  if (influencer) {
    const updates: Record<string, unknown> = {
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (EARLY_STATUSES.has(influencer.status)) {
      updates.status = 'declined'
      updates.status_changed_at = new Date().toISOString()
    }

    await admin.from('influencers').update(updates).eq('id', influencer.id)
  }
}
