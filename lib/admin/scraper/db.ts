import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Get admin client with untyped table access for scraper tables
 * (types will be generated after migrations are applied to prod).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getScraperDb(): any {
  return createAdminClient()
}
