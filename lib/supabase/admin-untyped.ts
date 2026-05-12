import { createClient } from '@supabase/supabase-js'

/**
 * Admin client WITHOUT typed schema.
 * Used for new admin tables (influencers, email_campaigns, campaign_recipients, etc.)
 * that haven't been added to the generated types.ts yet.
 *
 * TODO: Once `supabase gen types` is re-run with the admin schema,
 * switch these queries back to the typed createAdminClient().
 */
export function createAdminClientUntyped() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
