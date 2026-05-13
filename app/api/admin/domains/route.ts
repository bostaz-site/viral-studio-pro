import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list all domains with mailbox counts
export const GET = withAdmin(async () => {
  const supabase = createAdminClient()

  const { data: domains, error } = await supabase
    .from('domains')
    .select('*')
    .order('domain')

  if (error) return errorResponse(error.message, 500)

  // Count mailboxes per domain
  const { data: mailboxes } = await supabase
    .from('mailboxes')
    .select('domain')
    .is('retired_at', null)

  const domainCounts = new Map<string, number>()
  for (const mb of mailboxes ?? []) {
    domainCounts.set(mb.domain, (domainCounts.get(mb.domain) ?? 0) + 1)
  }

  const enriched = (domains ?? []).map(d => ({
    ...d,
    mailbox_count: domainCounts.get(d.domain) ?? 0,
  }))

  return jsonResponse(enriched)
})
