/**
 * Auto-onboarding pipeline — triggered when an influencer replies "interested"
 * to a cold email (detected by reply-classifier via sync-instantly cron).
 *
 * Steps:
 *   1. Generate affiliate code (if not already set)
 *   2. Generate magic link token → partner portal URL
 *   3. Pick demo video by niche from promo_videos
 *   4. Compose welcome email from template
 *   5. Send or save as draft (per auto_onboard_mode)
 *   6. Update status → 'demo_sent', log in admin_audit_log
 *
 * Idempotent: checks email_messages for existing welcome before acting.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generateAffiliateCode } from '@/lib/admin/affiliate-code'
import { generateMagicLinkToken } from '@/lib/partner/magic-link'
import { renderTemplate } from '@/lib/admin/offer-generator/template-renderer'
import type { OfferVariables } from '@/lib/admin/offer-generator/variable-extractor'
import { logger } from '@/lib/logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

export interface OnboardResult {
  success: boolean
  action: 'sent' | 'drafted' | 'skipped' | 'error'
  reason?: string
  messageId?: string
}

export async function autoOnboard(influencerId: string): Promise<OnboardResult> {
  const admin = createAdminClient()

  // Fetch influencer
  const { data: inf } = await admin
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .single()

  if (!inf) return { success: false, action: 'error', reason: 'Influencer not found' }

  const infData = inf as Record<string, unknown>

  // Idempotent: check if welcome already sent/drafted
  const { data: existing } = await (admin as unknown as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => { limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }> } } } } })
    .from('email_messages')
    .select('id, status')
    .eq('influencer_id', influencerId)
    .eq('template_name', 'cold-v1-welcome')
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, action: 'skipped', reason: 'Welcome already sent/drafted' }
  }

  // 1. Generate affiliate code
  let affiliateCode = String(infData.affiliate_code ?? '')
  if (!affiliateCode) {
    try {
      affiliateCode = await generateAffiliateCode(influencerId, String(infData.platform_handle ?? ''))
      await admin.from('influencers').update({ affiliate_code: affiliateCode } as never).eq('id', influencerId)
    } catch (err) {
      logger.error(`[auto-onboard] Affiliate code generation failed: ${(err as Error).message}`)
      affiliateCode = ''
    }
  }

  // 2. Generate magic link → partner portal URL
  let partnerPortalUrl = `${APP_URL}/partner`
  try {
    const token = await generateMagicLinkToken(influencerId)
    partnerPortalUrl = `${APP_URL}/partner/login?token=${token}`
  } catch (err) {
    logger.warn(`[auto-onboard] Magic link failed: ${(err as Error).message}`)
  }

  // 3. Pick demo video by niche
  const niche = String(infData.niche ?? 'gaming')
  let demoVideoUrl = `${APP_URL}/demo`
  try {
    const { data: promos } = await admin
      .from('promo_videos')
      .select('url, niche' as '*')
      .eq('active' as never, true)
      .order('created_at', { ascending: false })
      .limit(10)

    const promoList = (promos ?? []) as Array<Record<string, unknown>>
    const nicheMatch = promoList.find(p => String(p.niche ?? '').toLowerCase() === niche.toLowerCase())
    const fallback = promoList[0]
    const chosen = nicheMatch ?? fallback
    if (chosen?.url) demoVideoUrl = String(chosen.url)
  } catch { /* use fallback */ }

  // 4. Load welcome template
  const { data: tpl } = await admin
    .from('email_templates')
    .select('subject, body_text')
    .eq('name' as never, 'cold-v1-welcome')
    .single()

  if (!tpl) return { success: false, action: 'error', reason: 'Welcome template not found' }

  // Build variables
  const firstName = String(infData.first_name ?? infData.display_name ?? infData.platform_handle ?? 'there')
  const channelName = String(infData.display_name ?? infData.platform_handle ?? '')
  const senderName = process.env.COLD_EMAIL_SENDER_NAME ?? 'Samy'

  const vars: Partial<OfferVariables> & Record<string, string> = {
    firstName,
    channelName,
    niche,
    demoVideoUrl,
    partnerPortalUrl,
    senderName,
    unsubscribeLink: '{{unsubscribeLink}}',
    first_name: firstName,
  }

  const subject = renderTemplate(String(tpl.subject ?? ''), vars as OfferVariables)
  const body = renderTemplate(String(tpl.body_text ?? ''), vars as OfferVariables)

  // 5. Check mode (review = draft, auto = send)
  let mode: 'review' | 'auto' = 'review'
  try {
    const { data: settings } = await (admin as unknown as { from: (t: string) => { select: (s: string) => { limit: (n: number) => { single: () => Promise<{ data: Record<string, unknown> | null }> } } } })
      .from('distribution_settings')
      .select('auto_onboard_mode')
      .limit(1)
      .single()
    if (settings?.auto_onboard_mode === 'auto') mode = 'auto'
  } catch { /* default review */ }

  const messageStatus = mode === 'auto' ? 'sent' : 'draft'

  // Insert email_messages row
  const { data: msg, error: msgErr } = await (admin as unknown as { from: (t: string) => { insert: (r: Record<string, unknown>) => { select: (s: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } } } })
    .from('email_messages')
    .insert({
      influencer_id: influencerId,
      template_name: 'cold-v1-welcome',
      subject,
      body_text: body,
      status: messageStatus,
      direction: 'outbound',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (msgErr) {
    return { success: false, action: 'error', reason: `DB insert failed: ${msgErr.message}` }
  }

  // 6. Update influencer status
  await admin
    .from('influencers')
    .update({ status: mode === 'auto' ? 'demo_sent' : 'interested' } as never)
    .eq('id', influencerId)

  // Audit log
  try {
    await (admin as unknown as { from: (t: string) => { insert: (r: Record<string, unknown>) => Promise<unknown> } })
      .from('admin_audit_log')
      .insert({
        action: 'auto_onboard',
        entity_type: 'influencer',
        entity_id: influencerId,
        metadata: {
          mode,
          messageStatus,
          affiliateCode: affiliateCode || null,
          niche,
          messageId: msg?.id ?? null,
        },
        created_at: new Date().toISOString(),
      })
  } catch { /* non-critical */ }

  logger.info({ influencerId, mode, messageStatus }, '[auto-onboard] Completed')

  return {
    success: true,
    action: mode === 'auto' ? 'sent' : 'drafted',
    messageId: String(msg?.id ?? ''),
  }
}
