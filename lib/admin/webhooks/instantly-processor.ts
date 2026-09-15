import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'
import { postToDiscord } from '@/lib/discord/post'
import { getInstantlyClient } from '@/lib/integrations/instantly/client'

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

/** Statuses that are safe to auto-set on bounce/unsub/decline (early pipeline statuses) */
const EARLY_STATUSES = new Set(['unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied'])

type ReplyBucket = 'interested' | 'evaluating' | 'not_now' | 'wrong_person' | 'unsubscribed' | 'negative'

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
  const replyBody =
    (payload.body as string) ||
    (payload.text as string) ||
    (payload.reply_text as string) ||
    ''

  // 1. Always INSERT email_messages
  const { data: message } = await admin
    .from('email_messages')
    .insert({
      influencer_id: influencer?.id ?? null,
      direction: 'inbound',
      subject: (payload.subject as string) || null,
      body_text: replyBody || null,
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

  // 3. Classify reply → bucket
  const bucket = await classifyReplyBucket(replyBody)

  // 4. Update influencer counters + bucket + bucket-specific actions
  if (influencer) {
    const updates: Record<string, unknown> = {
      total_emails_replied: (influencer.total_emails_replied || 0) + 1,
      last_active_at: new Date().toISOString(),
      last_replied_at: new Date().toISOString(),
      has_replied: true,
      updated_at: new Date().toISOString(),
    }

    if (REPLY_SAFE_STATUSES.has(influencer.status)) {
      updates.status = 'replied'
      updates.status_changed_at = new Date().toISOString()
    }

    if (bucket) {
      updates.reply_bucket = bucket
      await applyBucketActions(admin, influencer, email, bucket, replyBody, updates)
    }

    await admin.from('influencers').update(updates).eq('id', influencer.id)

    // Post-update actions (autoOnboard runs after status is set)
    if (bucket === 'interested') {
      await triggerAutoOnboard(influencer.id, email)
    }
  }

  // 5. Discord notification for all classified replies
  if (bucket) {
    void sendReplyDiscord(email, bucket, replyBody, payload).catch(() => {})
  }
}

/**
 * Apply bucket-specific field updates + side effects.
 * Mutates the `updates` object with additional fields.
 */
async function applyBucketActions(
  admin: SupabaseClient,
  influencer: Influencer,
  email: string,
  bucket: ReplyBucket,
  replyBody: string,
  updates: Record<string, unknown>
) {
  switch (bucket) {
    case 'interested': {
      if (EARLY_STATUSES.has(influencer.status) || influencer.status === 'replied') {
        updates.status = 'interested'
        updates.status_changed_at = new Date().toISOString()
      }
      break
    }

    case 'evaluating': {
      if (EARLY_STATUSES.has(influencer.status) || influencer.status === 'replied') {
        updates.status = 'evaluating'
        updates.status_changed_at = new Date().toISOString()
      }
      break
    }

    case 'not_now': {
      const resequenceDate = new Date()
      resequenceDate.setDate(resequenceDate.getDate() + 60)
      updates.resequence_after = resequenceDate.toISOString().slice(0, 10)

      if (EARLY_STATUSES.has(influencer.status) || influencer.status === 'replied') {
        updates.status = 'dormant'
        updates.status_changed_at = new Date().toISOString()
      }

      // Remove from active Instantly campaigns
      try {
        const instantly = getInstantlyClient()
        await instantly.removeLeadFromAllCampaigns(email)
      } catch (err) {
        logger.warn({ email, error: (err as Error).message }, 'Failed to remove not_now lead from Instantly')
      }
      break
    }

    case 'wrong_person': {
      if (EARLY_STATUSES.has(influencer.status) || influencer.status === 'replied') {
        updates.status = 'declined'
        updates.status_changed_at = new Date().toISOString()
      }
      // Extract any forwarded contacts from reply
      const forwardedEmails = replyBody.match(/[\w.-]+@[\w.-]+\.\w{2,}/g) || []
      const forwardNote = forwardedEmails.length > 0
        ? `Wrong person. Forwarded contacts: ${forwardedEmails.join(', ')}`
        : 'Wrong person — no forwarded contact found'
      updates.notes = forwardNote
      break
    }

    case 'unsubscribed': {
      updates.unsubscribed = true
      updates.unsubscribed_at = new Date().toISOString()

      if (EARLY_STATUSES.has(influencer.status) || influencer.status === 'replied') {
        updates.status = 'declined'
        updates.status_changed_at = new Date().toISOString()
      }

      // Suppression list 4-way
      const domain = email.split('@')[1] || null
      await admin
        .from('suppression_list')
        .upsert(
          {
            email,
            email_domain: domain,
            reason: 'reply_stop',
            source: 'instantly_webhook',
            platform_handle: influencer.platform_handle ?? null,
            profile_url: influencer.platform_url ?? null,
            platform: influencer.primary_platform ?? null,
          },
          { onConflict: 'email' }
        )

      // Remove from Instantly campaigns
      try {
        const instantly = getInstantlyClient()
        await instantly.removeLeadFromAllCampaigns(email)
      } catch (err) {
        logger.warn({ email, error: (err as Error).message }, 'Failed to remove unsubscribed lead from Instantly')
      }
      break
    }

    case 'negative': {
      if (EARLY_STATUSES.has(influencer.status) || influencer.status === 'replied') {
        updates.status = 'declined'
        updates.status_changed_at = new Date().toISOString()
      }
      break
    }
  }
}

async function triggerAutoOnboard(influencerId: string, email: string): Promise<void> {
  try {
    const { autoOnboard } = await import('@/lib/admin/onboarding/auto-onboard')
    const result = await autoOnboard(influencerId)
    logger.info({ influencerId, email, action: result.action }, 'Auto-onboard triggered from reply bucket')
  } catch (err) {
    logger.warn({ influencerId, email, error: (err as Error).message }, 'Auto-onboard failed')
  }
}

async function sendReplyDiscord(
  email: string,
  bucket: ReplyBucket,
  body: string,
  payload: Record<string, unknown>
): Promise<void> {
  const colorMap: Record<ReplyBucket, number> = {
    interested: 0xff6b00,
    evaluating: 0x5865f2,
    not_now: 0xf59e0b,
    wrong_person: 0x6b7280,
    unsubscribed: 0xef4444,
    negative: 0xef4444,
  }

  const channel = bucket === 'interested' ? 'activity' : 'critical-alerts'

  await postToDiscord({
    channel,
    embed: {
      title: `Reply: ${bucket.replace('_', ' ')}`,
      description: `From: ${email}`,
      color: colorMap[bucket],
      fields: [
        { name: 'Campaign', value: String(payload.campaign_name ?? payload.campaign_id ?? 'N/A'), inline: true },
        { name: 'Bucket', value: bucket, inline: true },
        { name: 'Excerpt', value: body.slice(0, 300) || '(empty)', inline: false },
      ],
    },
  })
}

// --- Reply Classification ---

async function classifyReplyBucket(body: string): Promise<ReplyBucket | null> {
  if (!body.trim()) return null

  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      system: `Classify this cold email reply into exactly ONE category. Reply with ONLY the category name.
Categories:
- interested: wants the offer, says yes, send clips
- evaluating: asking questions, wants more info, how much
- not_now: says not now, later, bad timing, busy
- wrong_person: wrong contact, should reach someone else
- unsubscribed: says stop, unsubscribe, remove me, don't contact
- negative: hard no, not interested, hostile
- auto_reply: out of office, automated, vacation`,
      messages: [{ role: 'user', content: body.slice(0, 1000) }],
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text.trim().toLowerCase()
      : ''

    const validBuckets: ReplyBucket[] = ['interested', 'evaluating', 'not_now', 'wrong_person', 'unsubscribed', 'negative']
    if (validBuckets.includes(text as ReplyBucket)) {
      return text as ReplyBucket
    }
    if (text === 'auto_reply') return null // No bucket for auto-replies
    return 'evaluating' // Default fallback
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Reply classification failed, defaulting to evaluating')
    return 'evaluating'
  }
}

// --- Existing handlers (bounce, unsub) ---

async function handleEmailBounced(
  admin: SupabaseClient,
  webhookEventId: string,
  payload: Record<string, unknown>,
  email: string,
  influencer: Influencer | null
) {
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

  if (influencer && EARLY_STATUSES.has(influencer.status)) {
    await admin
      .from('influencers')
      .update({
        status: 'blocked',
        has_bounced: true,
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
  await admin.from('email_events').insert({
    influencer_id: influencer?.id ?? null,
    event_type: 'unsubscribed',
    occurred_at: ts(payload),
    metadata: { email },
    webhook_event_id: webhookEventId,
  })

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

  if (influencer) {
    const updates: Record<string, unknown> = {
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      reply_bucket: 'unsubscribed' as const,
      updated_at: new Date().toISOString(),
    }

    if (EARLY_STATUSES.has(influencer.status)) {
      updates.status = 'declined'
      updates.status_changed_at = new Date().toISOString()
    }

    await admin.from('influencers').update(updates).eq('id', influencer.id)
  }
}
