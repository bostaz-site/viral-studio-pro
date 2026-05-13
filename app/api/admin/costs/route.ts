import { z } from 'zod'
import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeMonthlyCosts, computePnL } from '@/lib/admin/costs/calculator'

// GET /api/admin/costs?month=2026-05
export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const now = new Date()
  const month = url.searchParams.get('month') ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const admin = createAdminClient()

  const [costs, pnl] = await Promise.all([
    computeMonthlyCosts(admin, month),
    computePnL(admin, month),
  ])

  return jsonResponse({ costs, pnl })
})

const addCostSchema = z.object({
  category: z.enum(['infra', 'cold_email', 'tools', 'vas', 'legal', 'banking', 'taxes', 'misc']),
  vendor: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  amount_cents: z.number().int().min(1),
  billing_period_start: z.string(),
  billing_period_end: z.string().optional(),
  invoice_url: z.string().url().optional(),
})

// POST /api/admin/costs — add manual cost entry
export const POST = withAdmin(async (req, user) => {
  const parsed = addCostSchema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('costs_manual')
    .insert({
      ...parsed.data,
      added_by: user.id,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
