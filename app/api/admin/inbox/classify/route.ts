import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyReply } from '@/lib/admin/ai/reply-classifier'

const schema = z.object({
  messageId: z.string().uuid(),
})

// POST /api/admin/inbox/classify — classify a single message
export const POST = withAdmin(async (req) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { messageId } = parsed.data
  const admin = createAdminClient()

  // Get message + influencer
  const { data: message } = await admin
    .from('email_messages')
    .select('id, body_text, influencer_id, ai_sentiment')
    .eq('id', messageId)
    .single()

  if (!message) return errorResponse('Message not found', 404)

  // Idempotency: skip if already classified
  if (message.ai_sentiment) {
    return jsonResponse({ alreadyClassified: true, sentiment: message.ai_sentiment })
  }

  const { data: influencer } = await admin
    .from('influencers')
    .select('display_name, first_name, email, primary_platform, niche, audience_size')
    .eq('id', message.influencer_id!)
    .single()

  const result = await classifyReply({
    messageId,
    body: message.body_text || '',
    influencerName: influencer?.display_name || influencer?.first_name || influencer?.email || '',
    platform: influencer?.primary_platform || 'unknown',
    niche: influencer?.niche || '',
    audienceSize: influencer?.audience_size ?? null,
  })

  if (!result) return errorResponse('Classification failed', 502)

  // Update email_messages
  await admin
    .from('email_messages')
    .update({
      ai_sentiment: result.sentiment === 'neutral_question' ? 'neutral' : result.sentiment,
      ai_intent: result.intent,
      ai_confidence: result.confidence,
      ai_classified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  return jsonResponse(result)
})
