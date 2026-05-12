import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { interpolateTemplate } from '@/lib/admin/email/template-vars'
import { sendViaInstantly } from '@/lib/admin/email/instantly-send'

const replySchema = z.object({
  influencer_id: z.string().uuid(),
  in_reply_to_message_id: z.string().uuid().optional(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
  from_email: z.string().email(),
})

// POST /api/admin/inbox/reply — send a reply to an influencer
export const POST = withAdmin(async (req, user) => {
  const parsed = replySchema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { influencer_id, in_reply_to_message_id, subject, body, from_email } = parsed.data
  const admin = createAdminClient()

  // 1. Get influencer for template vars + email
  const { data: influencer, error: infError } = await admin
    .from('influencers')
    .select('*')
    .eq('id', influencer_id)
    .single()

  if (infError || !influencer) {
    return errorResponse('Influencer not found', 404)
  }

  // 2. Check suppression list
  const { data: suppressed } = await admin
    .from('suppression_list')
    .select('id')
    .eq('email', influencer.email.toLowerCase())
    .limit(1)

  if (suppressed && suppressed.length > 0) {
    return errorResponse('This email is on the suppression list and cannot be contacted', 403)
  }

  // 3. Check unsubscribed
  if (influencer.unsubscribed) {
    return errorResponse('This influencer has unsubscribed', 403)
  }

  // 4. Apply template variables server-side
  const interpolatedBody = interpolateTemplate(body, influencer)
  const interpolatedSubject = interpolateTemplate(subject, influencer)

  // 5. Get in_reply_to message_id_external for threading
  let inReplyToExternal: string | undefined
  let threadId: string | undefined
  if (in_reply_to_message_id) {
    const { data: replyToMsg } = await admin
      .from('email_messages')
      .select('message_id_external, thread_id')
      .eq('id', in_reply_to_message_id)
      .single()
    inReplyToExternal = replyToMsg?.message_id_external ?? undefined
    threadId = replyToMsg?.thread_id ?? undefined
  }
  // Fallback thread_id to influencer email
  if (!threadId) threadId = influencer.email.toLowerCase()

  // 6. Verify mailbox exists and is active
  const { data: mailbox } = await admin
    .from('mailboxes')
    .select('id, email, status')
    .eq('email', from_email)
    .single()

  if (!mailbox) {
    return errorResponse(`Mailbox ${from_email} not found`, 404)
  }
  if (mailbox.status !== 'active' && mailbox.status !== 'warming') {
    return errorResponse(`Mailbox ${from_email} is ${mailbox.status}`, 400)
  }

  // 7. Send via Instantly
  const sendResult = await sendViaInstantly({
    fromEmail: from_email,
    toEmail: influencer.email,
    subject: interpolatedSubject,
    body: interpolatedBody,
    inReplyTo: inReplyToExternal,
  })

  if (!sendResult.success) {
    return errorResponse(`Send failed: ${sendResult.error}`, 502)
  }

  // 8. INSERT outbound message into email_messages
  const { data: message, error: msgError } = await admin
    .from('email_messages')
    .insert({
      influencer_id,
      mailbox_id: mailbox.id,
      in_reply_to_message_id: in_reply_to_message_id ?? null,
      direction: 'outbound',
      subject: interpolatedSubject,
      body_text: interpolatedBody,
      message_id_external: sendResult.messageId ?? null,
      thread_id: threadId,
      sent_at: new Date().toISOString(),
      is_read: true,
      is_archived: false,
      is_starred: false,
    })
    .select('id')
    .single()

  if (msgError) {
    // Email was sent but DB insert failed — log and return partial success
    console.error('[inbox/reply] Message sent but DB insert failed:', msgError.message)
    return jsonResponse({
      sent: true,
      saved: false,
      error: msgError.message,
    }, 207)
  }

  // 9. Update influencer metrics
  await admin
    .from('influencers')
    .update({
      total_emails_sent: (influencer.total_emails_sent || 0) + 1,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', influencer_id)

  return jsonResponse({
    sent: true,
    saved: true,
    messageId: message.id,
  })
})
