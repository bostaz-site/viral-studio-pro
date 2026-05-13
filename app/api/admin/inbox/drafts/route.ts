import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReplyDrafts } from '@/lib/admin/ai/reply-drafter'

const schema = z.object({
  messageId: z.string().uuid(),
})

// POST /api/admin/inbox/drafts — generate reply drafts for a message
export const POST = withAdmin(async (req) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { messageId } = parsed.data
  const admin = createAdminClient()

  const { data: message } = await admin
    .from('email_messages')
    .select('id, body_text, influencer_id, ai_sentiment')
    .eq('id', messageId)
    .eq('direction', 'inbound')
    .single()

  if (!message) return errorResponse('Inbound message not found', 404)

  const { data: influencer } = await admin
    .from('influencers')
    .select('display_name, first_name, email, primary_platform, niche, audience_size')
    .eq('id', message.influencer_id!)
    .single()

  const result = await generateReplyDrafts({
    messageId,
    replyBody: message.body_text || '',
    influencerName: influencer?.display_name || influencer?.first_name || influencer?.email || '',
    platform: influencer?.primary_platform || 'unknown',
    niche: influencer?.niche || '',
    audienceSize: influencer?.audience_size ?? null,
    sentiment: message.ai_sentiment || 'neutral',
  })

  if (!result) return errorResponse('Draft generation failed', 502)

  return jsonResponse(result)
})
