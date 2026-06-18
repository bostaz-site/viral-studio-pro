import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient() as AnyClient
  const url = req.nextUrl
  const status = url.searchParams.get('status')

  let query = admin
    .from('ai_multiplier_opportunities')
    .select('*')
    .order('impact_score', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

const updateSchema = z.object({
  status: z.enum(['proposed', 'in_progress', 'shipped', 'discarded']),
})

export const PATCH = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient() as AnyClient
  const url = req.nextUrl
  const id = url.searchParams.get('id')

  if (!id) return errorResponse('Missing id parameter', 400)

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Invalid status', 400)

  const updates: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'shipped') {
    updates.shipped_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('ai_multiplier_opportunities')
    .update(updates)
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
