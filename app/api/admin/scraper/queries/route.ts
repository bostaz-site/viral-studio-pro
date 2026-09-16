import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'

// GET — list autopilot queries
export const GET = withAdmin(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getScraperDb() as any
  const { data, error } = await db
    .from('scraper_queries')
    .select('*')
    .order('last_run_at', { ascending: true, nullsFirst: true })

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

const toggleSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
})

// PATCH — toggle enabled/disabled
export const PATCH = withAdmin(async (req) => {
  const body = await req.json()
  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getScraperDb() as any
  const { error } = await db
    .from('scraper_queries')
    .update({ enabled: parsed.data.enabled, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse({ updated: true })
})
