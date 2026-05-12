import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

// GET - search influencers with filters (for campaign recipient selection)
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || []
  const niches = url.searchParams.get('niches')?.split(',').filter(Boolean) || []
  const platforms = url.searchParams.get('platforms')?.split(',').filter(Boolean) || []
  const audienceMin = url.searchParams.get('audience_min')
  const audienceMax = url.searchParams.get('audience_max')
  const country = url.searchParams.get('country')
  const search = url.searchParams.get('search')

  const admin = createAdminClientUntyped()

  let query = admin
    .from('influencers')
    .select('id, email, display_name, first_name, primary_platform, niche, audience_size, status, country', { count: 'exact' })
    .eq('unsubscribed', false)
    .order('lead_score', { ascending: false })
    .limit(500)

  if (statuses.length > 0) query = query.in('status', statuses)
  if (niches.length > 0) query = query.in('niche', niches)
  if (platforms.length > 0) query = query.in('primary_platform', platforms)
  if (audienceMin) query = query.gte('audience_size', parseInt(audienceMin))
  if (audienceMax) query = query.lte('audience_size', parseInt(audienceMax))
  if (country) query = query.ilike('country', country)
  if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)

  const { data, count, error } = await query
  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ influencers: data || [], count: count || 0 })
})
