import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { resumeEmailAccount } from '@/lib/admin/mailbox/instantly-actions'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 2]
}

// POST — resume a mailbox
export const POST = withAdmin(async (req) => {
  const id = extractId(req)
  const supabase = createAdminClient()

  const { data: mailbox } = await supabase
    .from('mailboxes')
    .select('id, instantly_account_id, status')
    .eq('id', id)
    .single()

  if (!mailbox) return errorResponse('Mailbox not found', 404)
  if (mailbox.status === 'active') return errorResponse('Already active', 409)

  if (mailbox.instantly_account_id) {
    try {
      await resumeEmailAccount(mailbox.instantly_account_id)
    } catch (err) {
      return errorResponse(`Instantly API error: ${err instanceof Error ? err.message : 'unknown'}`, 502)
    }
  }

  await supabase
    .from('mailboxes')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)

  return jsonResponse({ resumed: true })
})
