import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  status: z.enum(['open', 'fixed', 'doing', 'later', 'ignore']),
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
    return errorResponse('Invalid status value', 400)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audit_findings')
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
      ...(parsed.data.status === 'fixed' ? { last_verified_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
