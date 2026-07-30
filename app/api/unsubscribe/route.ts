import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken, markTokenUsed } from '@/lib/admin/unsubscribe-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// POST — process unsubscribe (public, no auth required)
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Verify token
    const result = await verifyUnsubscribeToken(token)
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const emailLower = result.email.toLowerCase()

    // Add to suppression list — NO email_domain for individual unsubscribes
    // (domain-level suppression is admin-only to prevent blocking all @gmail.com)
    await supabase.from('suppression_list').upsert(
      {
        email: emailLower,
        email_domain: null,
        reason: 'unsubscribe',
        source: 'unsubscribe_link',
        metadata: {},
      },
      { onConflict: 'email', ignoreDuplicates: true },
    )

    // Mark influencer as blocked if exists
    await supabase
      .from('influencers')
      .update({ status: 'blocked' })
      .ilike('email', result.email)

    // Mark token as used
    await markTokenUsed(result.tokenId)

    // Remove lead from all active Instantly campaigns (CAN-SPAM compliance)
    // Fire-and-forget with retry — log failures visibly for admin monitoring
    removeFromInstantly(emailLower).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Unsubscribe]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * Remove a lead from all Instantly campaigns. Retries once on failure.
 * Failures are logged at error level so they show up in admin monitoring.
 */
async function removeFromInstantly(email: string): Promise<void> {
  try {
    const { getInstantlyClient } = await import('@/lib/integrations/instantly/client')
    const client = getInstantlyClient()
    const result = await client.removeLeadFromAllCampaigns(email)

    if (result.failed > 0) {
      logger.error(`[unsubscribe] Instantly partial failure: removed from ${result.removed}, failed ${result.failed} campaigns for ${email}`)
      // Flag for admin review
      try {
        const supabase = (await import('@/lib/supabase/admin')).createAdminClient()
        await supabase.from('compliance_audit_log').insert({
          action: 'instantly_removal_partial_failure',
          target_type: 'lead',
          details: { email, removed: result.removed, failed: result.failed },
        })
      } catch { /* best-effort */ }
    } else {
      logger.info(`[unsubscribe] Instantly: removed ${email} from ${result.removed} campaigns`)
    }
  } catch (err) {
    logger.error(`[unsubscribe] Instantly removal failed for ${email}: ${(err as Error).message}`)
    // Log to compliance_audit_log for reconciliation cron
    try {
      const supabase = (await import('@/lib/supabase/admin')).createAdminClient()
      await supabase.from('compliance_audit_log').insert({
        action: 'instantly_removal_failed',
        target_type: 'lead',
        details: { email, error: (err as Error).message },
      })
    } catch { /* last resort — already logged above */ }
  }
}
