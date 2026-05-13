import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { summarizeThread } from '@/lib/admin/ai/thread-summarizer'

const schema = z.object({
  influencerId: z.string().uuid(),
})

// POST /api/admin/inbox/summarize — summarize a thread
export const POST = withAdmin(async (req) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { influencerId } = parsed.data
  const admin = createAdminClient()

  const { data: messages } = await admin
    .from('email_messages')
    .select('direction, body_text, sent_at, created_at')
    .eq('influencer_id', influencerId)
    .order('created_at', { ascending: true })

  if (!messages || messages.length < 5) {
    return errorResponse('Thread needs at least 5 messages for a summary', 400)
  }

  const result = await summarizeThread({ influencerId, messages })

  if (!result) return errorResponse('Summary generation failed', 502)

  return jsonResponse(result)
})
