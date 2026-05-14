import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'active'
  const admin = createAdminClient()

  let query = admin.from('offer_templates').select('*').order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return errorResponse('Failed to load templates', 500)
  return jsonResponse(data || [])
})

export const POST = withAdmin(async (req: NextRequest, user) => {
  const body = await req.json()
  const { name, description, subject_line_variants, body_template, niche, audience_min, audience_max, language } = body

  if (!name || !body_template) return errorResponse('name and body_template required')
  if (!subject_line_variants?.length) return errorResponse('At least 1 subject variant required')

  const admin = createAdminClient()
  const { data, error } = await admin.from('offer_templates').insert({
    name, description: description || null, subject_line_variants, body_template,
    niche: niche || [], audience_min: audience_min ?? null, audience_max: audience_max ?? null,
    language: language || 'en', created_by: user.id,
  }).select().single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
