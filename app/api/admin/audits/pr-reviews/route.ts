import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest) => {
  const admin = createAdminClient()
  const url = req.nextUrl

  const grade = url.searchParams.get('grade')
  const author = url.searchParams.get('author')
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('pr_reviews')
    .select('*')
    .order('merged_at', { ascending: false })
    .limit(Math.min(limit, 100))

  if (grade) query = query.eq('overall_grade', grade)
  if (author) query = query.eq('merged_by', author)

  const { data, error } = await query

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
