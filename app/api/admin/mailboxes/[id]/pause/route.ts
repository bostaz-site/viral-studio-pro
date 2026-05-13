import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { pauseEmailAccount } from '@/lib/admin/mailbox/instantly-actions'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 2]
}

// POST — pause a mailbox
export const POST = withAdmin(async (req) => {
  const id = extractId(req)
  const supabase = createAdminClient()

  const { data: mailbox } = await supabase
    .from('mailboxes')
    .select('id, instantly_account_id, status')
    .eq('id', id)
    .single()

  if (!mailbox) return errorResponse('Mailbox not found', 404)
  if (mailbox.status === 'paused') return errorResponse('Already paused', 409)

  // Pause in Instantly if connected
  if (mailbox.instantly_account_id) {
    try {
      await pauseEmailAccount(mailbox.instantly_account_id)
    } catch (err) {
      return errorResponse(`Instantly API error: ${err instanceof Error ? err.message : 'unknown'}`, 502)
    }
  }

  // Update local status
  await supabase
    .from('mailboxes')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', id)

  return jsonResponse({ paused: true })
})
