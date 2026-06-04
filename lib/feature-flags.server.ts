/**
 * Server-only feature flag helpers.
 * DO NOT import from client components — use `lib/feature-flags.ts` instead.
 */
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/is-admin'
import { isAuditMode } from '@/lib/feature-flags'

/**
 * Server-only. Returns true if audit mode is active AND current user is NOT admin.
 * Admins always bypass audit mode and see the full app.
 * Cached per-request via React `cache()` to avoid duplicate DB queries.
 */
export const isEffectiveAuditMode = cache(async (): Promise<boolean> => {
  if (!isAuditMode) return false
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return true // anonymous = audit mode applies
  const admin = await isAdminUser(supabase, user.id)
  return !admin // admins bypass
})
