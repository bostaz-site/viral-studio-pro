import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { postToDiscord } from '@/lib/discord/post'

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

type ReplyClassification =
  | 'positive_interested'
  | 'question'
  | 'negative'
  | 'unsubscribe'
  | 'auto_reply'

/**
 * POST /api/webhooks/instantly
 *
 * Receives reply webhooks from Instantly.
 * Classifies the reply sentiment via Claude Haiku, then posts to Discord.
 */
export async function POST(req: NextRequest) {
  // Verify webhook source (Instantly sends a secret header if configured)
  const secret = req.headers.get('x-instantly-secret')
  if (process.env.INSTANTLY_WEBHOOK_SECRET && secret !== process.env.INSTANTLY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: {
    event_type?: string
    reply?: {
      id?: string
      from_email?: string
      to_email?: string
      subject?: string
      body?: string
      campaign_name?: string
    }
  }

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const reply = payload.reply
  if (!reply?.body || !reply.from_email) {
    return NextResponse.json({ received: true, skipped: 'no reply body' })
  }

  // Classify reply via Claude Haiku
  const classification = await classifyReply(reply.body)

  // Post to Discord
  const channel =
    classification === 'positive_interested' ? 'positive-replies' : 'cold-email-replies'

  const color =
    classification === 'positive_interested'
      ? 0xff6b00
      : classification === 'negative' || classification === 'unsubscribe'
        ? 0xff0000
        : 0x5865f2

  const titleMap: Record<ReplyClassification, string> = {
    positive_interested: 'POSITIVE reply (priority!)',
    question: 'Question received',
    negative: 'Negative reply',
    unsubscribe: 'Unsubscribe request',
    auto_reply: 'Auto-reply (ignore)',
  }

  await postToDiscord({
    channel,
    embed: {
      title: titleMap[classification],
      description: `From: ${reply.from_email}`,
      color,
      fields: [
        { name: 'Campaign', value: reply.campaign_name ?? 'N/A', inline: true },
        { name: 'Sentiment', value: classification, inline: true },
        { name: 'Excerpt', value: (reply.body ?? '').slice(0, 300), inline: false },
      ],
    },
    components:
      classification === 'positive_interested'
        ? [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3,
                  label: 'Auto-generate promo code',
                  custom_id: `generate_promo:${reply.from_email}`,
                },
                {
                  type: 2,
                  style: 2,
                  label: 'Suggest reply',
                  custom_id: `suggest_reply:${reply.from_email}`,
                },
                {
                  type: 2,
                  style: 4,
                  label: 'Mark spam',
                  custom_id: `mark_spam:${reply.from_email}`,
                },
              ],
            },
          ]
        : undefined,
  })

  return NextResponse.json({ received: true, classification })
}

async function classifyReply(body: string): Promise<ReplyClassification> {
  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system:
        'Classify this cold email reply into exactly ONE category. Reply with ONLY the category name, nothing else: positive_interested, question, negative, unsubscribe, auto_reply',
      messages: [{ role: 'user', content: body.slice(0, 1000) }],
    })

    const text =
      response.content[0].type === 'text'
        ? response.content[0].text.trim().toLowerCase()
        : 'question'

    const valid: ReplyClassification[] = [
      'positive_interested',
      'question',
      'negative',
      'unsubscribe',
      'auto_reply',
    ]
    return valid.includes(text as ReplyClassification)
      ? (text as ReplyClassification)
      : 'question'
  } catch {
    return 'question'
  }
}
