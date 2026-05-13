import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { syncInstantlyStats } from '@/lib/integrations/instantly/sync'

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 2] // /mailboxes/[id]/sync → id is -2
}

// POST — force re-sync for a specific mailbox
export const POST = withAdmin(async (req) => {
  const id = extractId(req)

  try {
    // Full sync (Instantly doesn't support per-account sync, so we sync all)
    const result = await syncInstantlyStats()
    return jsonResponse({ synced: true, mailbox_id: id, result })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Sync failed', 500)
  }
})
