import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || ''
  const templateId = url.searchParams.get('templateId') || ''
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = 50
  const admin = createAdminClient()

  let query = admin.from('generated_offers').select(`
    id, status, rendered_subject, repost_kit_url, passed_compliance,
    compliance_blocks, selected_subject_variant, generated_at, sent_at, template_id,
    influencers!inner ( id, email, display_name, first_name, platform_handle, niche, audience_size )
  `, { count: 'exact' }).order('generated_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (templateId) query = query.eq('template_id', templateId)
  query = query.range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query
  if (error) return errorResponse('Failed to load offers', 500)

  const { count: totalDraft } = await admin.from('generated_offers').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('passed_compliance', true)
  const { count: totalSent } = await admin.from('generated_offers').select('id', { count: 'exact', head: true }).eq('status', 'sent')
  const { count: totalBlocked } = await admin.from('generated_offers').select('id', { count: 'exact', head: true }).eq('passed_compliance', false)

  return jsonResponse({
    offers: data || [], total: count || 0, page, hasMore: (data?.length || 0) === limit,
    stats: { draft: totalDraft || 0, sent: totalSent || 0, blocked: totalBlocked || 0 },
  })
})
