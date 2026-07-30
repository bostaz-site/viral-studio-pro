import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_REASONS = [
  'unsubscribe',
  'hard_bounce',
  'soft_bounce_threshold',
  'complaint',
  'manual_block',
  'gdpr_request',
  'fraud_flag',
] as const

const addSchema = z.object({
  entries: z.array(
    z.object({
      email: z.string().email().optional(),
      email_domain: z.string().min(3).optional(),
      reason: z.enum(VALID_REASONS),
      source: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).refine((e) => e.email || e.email_domain, 'Either email or email_domain is required'),
  ).min(1).max(500),
})

const removeSchema = z.object({
  id: z.string().uuid(),
})

// GET — list suppression entries with filters
export const GET = withAdmin(async (req) => {
  const supabase = createAdminClient()
  const url = new URL(req.url)

  const reason = url.searchParams.get('reason')
  const search = url.searchParams.get('search')
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') ?? '50')))
  const offset = (page - 1) * limit

  // Stats query
  const { data: stats } = await supabase.rpc('get_suppression_stats').single()

  // Main query
  let query = supabase
    .from('suppression_list')
    .select('*', { count: 'exact' })
    .order('added_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (reason) query = query.eq('reason', reason)
  if (search) {
    const safeSearch = search.replace(/[,()]/g, '')
    query = query.or(`email.ilike.%${safeSearch}%,email_domain.ilike.%${safeSearch}%`)
  }

  const { data, error, count } = await query

  if (error) return errorResponse(error.message, 500)

  return jsonResponse({
    entries: data ?? [],
    total: count ?? 0,
    page,
    limit,
    stats: stats ?? null,
  })
})

// POST — add entries to suppression list
export const POST = withAdmin(async (req, user) => {
  const body = await req.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()
  const entries = parsed.data.entries.map((e) => ({
    email: e.email?.toLowerCase() ?? null,
    email_domain: e.email_domain?.toLowerCase() ?? (e.email ? e.email.toLowerCase().split('@')[1] : null),
    reason: e.reason,
    source: e.source ?? 'manual',
    metadata: (e.metadata ?? {}) as Record<string, string>,
    added_by: user.id,
  }))

  const { data, error } = await supabase
    .from('suppression_list')
    .upsert(entries, { onConflict: 'email', ignoreDuplicates: true })
    .select()

  if (error) return errorResponse(error.message, 500)

  return jsonResponse({ added: data?.length ?? 0, total_requested: entries.length })
})

// DELETE — remove entry from suppression list
export const DELETE = withAdmin(async (req) => {
  const body = await req.json()
  const parsed = removeSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('suppression_list')
    .delete()
    .eq('id', parsed.data.id)

  if (error) return errorResponse(error.message, 500)

  return jsonResponse({ deleted: true })
})
