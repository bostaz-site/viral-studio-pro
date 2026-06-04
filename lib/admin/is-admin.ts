import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if a user has admin-level access via the admin_users table.
 * Returns true for 'owner' or 'admin' roles (ops/va/finance/readonly don't bypass audit mode).
 */
export async function isAdminUser(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false
  const { data } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .maybeSingle()
  return !!data
}
