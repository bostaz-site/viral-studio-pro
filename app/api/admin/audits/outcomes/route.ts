import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export const GET = withAdmin(async () => {
  const admin = createAdminClient() as AnyClient

  const { data, error } = await admin
    .from('outcome_measurements')
    .select('*')
    .order('measured_at', { ascending: false })
    .limit(100)

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
