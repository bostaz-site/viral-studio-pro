import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  source: z.string(),
  query: z.string().min(3),
  filters: z.record(z.string(), z.unknown()).optional(),
})

// GET — list saved searches
export const GET = withAdmin(async () => {
  const supabase = getScraperDb()
  const { data, error } = await supabase
    .from('scraper_saved_searches')
    .select('*')
    .order('last_run_at', { ascending: false, nullsFirst: false })

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST — create saved search
export const POST = withAdmin(async (req, user) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = getScraperDb()
  const { data, error } = await supabase
    .from('scraper_saved_searches')
    .insert({
      ...parsed.data,
      filters: (parsed.data.filters ?? {}) as Record<string, string>,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
