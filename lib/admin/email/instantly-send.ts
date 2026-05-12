/**
 * Send email via Instantly API v2.
 * Docs: https://developer.instantly.ai/
 *
 * Uses the Instantly "send" endpoint to send a reply through
 * an existing warmed mailbox — preserving sender reputation.
 */

interface SendEmailParams {
  fromEmail: string        // Must be a mailbox registered in Instantly
  toEmail: string
  subject: string
  body: string             // Plain text
  inReplyTo?: string       // Message-ID header for threading
  replyToMessageId?: string // Instantly's internal message id
}

interface InstantlySendResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendViaInstantly(params: SendEmailParams): Promise<InstantlySendResult> {
  const apiKey = process.env.INSTANTLY_API_KEY
  if (!apiKey) {
    return { success: false, error: 'INSTANTLY_API_KEY not configured' }
  }

  try {
    const response = await fetch('https://api.instantly.ai/api/v2/emails/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: params.fromEmail,
        to: [params.toEmail],
        subject: params.subject,
        body: params.body,
        ...(params.inReplyTo ? { in_reply_to: params.inReplyTo } : {}),
        ...(params.replyToMessageId ? { reply_to_message_id: params.replyToMessageId } : {}),
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return { success: false, error: `Instantly API ${response.status}: ${errBody}` }
    }

    const data = await response.json()
    return {
      success: true,
      messageId: data.message_id || data.id || undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown send error',
    }
  }
}
