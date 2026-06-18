import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  status: z.enum(['identified', 'in_progress', 'fixed', 'discarded']).optional(),
  fix_pr_url: z.string().url().optional(),
})

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  return segments[segments.length - 1]
}

export const PATCH = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse('Invalid update', 400)
  }

  const admin = createAdminClient()
  const update: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'fixed') {
    update.fixed_at = new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('root_cause_clusters')
    .update(update)
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

export const GET = withAdmin(async (req: NextRequest) => {
  const id = extractId(req)
  const admin = createAdminClient()

  // Get cluster
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cluster, error } = await (admin as any)
    .from('root_cause_clusters')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return errorResponse(error.message, 500)

  // Get linked findings
  const { data: findings } = await admin
    .from('audit_findings')
    .select('id, severity, agent_type, title, location, status')
    .eq('root_cause_cluster_id', id)
    .order('severity', { ascending: true })

  return jsonResponse({ cluster, findings: findings ?? [] })
})
