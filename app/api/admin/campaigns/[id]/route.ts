import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

// GET - single campaign with recipient stats
export const GET = withAdmin(async (req) => {
  const campaignId = req.nextUrl.pathname.split('/').pop()
  if (!campaignId) return errorResponse('Campaign ID required')

  const admin = createAdminClientUntyped()

  const { data: campaign, error } = await admin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error || !campaign) return errorResponse('Campaign not found', 404)

  // Get recipient stats
  const { data: recipients } = await admin
    .from('campaign_recipients')
    .select('id, influencer_id, status, sent_at, last_event_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  // Get export logs from storage
  const { data: exports } = await admin.storage
    .from('campaign-exports')
    .list(campaignId, { sortBy: { column: 'created_at', order: 'desc' } })

  return jsonResponse({
    ...campaign,
    recipients: recipients || [],
    export_files: (exports || []).map((f) => ({
      name: f.name,
      created_at: f.created_at,
      size: f.metadata?.size,
    })),
  })
})

const updateSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'archived']).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
})

// PATCH - update campaign status/info
export const PATCH = withAdmin(async (req) => {
  const campaignId = req.nextUrl.pathname.split('/').pop()
  if (!campaignId) return errorResponse('Campaign ID required')

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const admin = createAdminClientUntyped()

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.status) updates.status = parsed.data.status
  if (parsed.data.name) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description

  const { data, error } = await admin
    .from('email_campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
