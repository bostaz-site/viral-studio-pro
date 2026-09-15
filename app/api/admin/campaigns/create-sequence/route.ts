import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { InstantlyClient } from '@/lib/integrations/instantly/client'
import { createSequenceSchema } from '@/lib/schemas/cold-email'
import { sequenceCompliancePreflight } from '@/lib/admin/offer-generator/compliance-preflight'

/**
 * POST /api/admin/campaigns/create-sequence
 *
 * Creates an Instantly campaign from email_templates with matching sequence_id.
 * V2 rules: trackOpens OFF everywhere, trackClicks only step 3, daily_limit 12,
 * stop_on_reply=true, stop_on_auto_reply=false, Mon-Fri 08-16h America/Toronto.
 */
export const POST = withAdmin(async (req) => {
  const body = await req.json()
  const parsed = createSequenceSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { sequenceId, emailAccountIds, campaignName } = parsed.data
  const admin = createAdminClient()

  // Block mailboxes on viralanimal.com domain or Zoho provider
  const { data: blockedBoxes } = await admin
    .from('mailboxes')
    .select('email, domain, provider')
    .in('instantly_account_id' as never, emailAccountIds)
    .or('domain.eq.viralanimal.com,provider.eq.zoho')

  if (blockedBoxes && blockedBoxes.length > 0) {
    const blocked = (blockedBoxes as Array<Record<string, unknown>>).map(b => String(b.email)).join(', ')
    return errorResponse(`Refused: mailboxes on blocked domain/provider: ${blocked}`, 400)
  }

  // Load templates for this sequence
  const { data: templates, error: tplErr } = await admin
    .from('email_templates')
    .select('*')
    .eq('sequence_id' as never, sequenceId)
    .not('step_number' as never, 'is', null)
    .order('step_number' as never, { ascending: true })

  if (tplErr || !templates || templates.length === 0) {
    return errorResponse(`No templates found for sequence "${sequenceId}"`, 404)
  }

  // Compliance preflight v2
  const preflightResult = sequenceCompliancePreflight(
    templates.map((t: Record<string, unknown>) => ({
      step_number: Number(t.step_number),
      body_text: String(t.body_text ?? ''),
      max_words: Number(t.max_words ?? 80),
    }))
  )

  if (!preflightResult.pass) {
    const violations = preflightResult.steps
      .filter(s => s.violations.length > 0)
      .map(s => `Step ${s.step}: ${s.violations.join('; ')}`)
    return NextResponse.json(
      { error: 'Compliance preflight failed', violations },
      { status: 422 }
    )
  }

  // Check bounce rate on active campaigns (v2 threshold: 1.5%)
  try {
    const { data: activeCampaigns } = await admin
      .from('email_campaigns')
      .select('bounce_rate' as '*')
      .not('instantly_campaign_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    const bounceRates = ((activeCampaigns ?? []) as Array<Record<string, unknown>>)
      .map(c => Number(c.bounce_rate ?? 0))
      .filter(r => r > 0)
    const avgBounce = bounceRates.length > 0 ? bounceRates.reduce((a, b) => a + b, 0) / bounceRates.length : 0
    if (avgBounce > 1.5) {
      return errorResponse(`Compliance: avg bounce rate ${avgBounce.toFixed(1)}% exceeds 1.5% threshold. Pause and re-verify list.`, 400)
    }
  } catch { /* non-critical */ }

  // Build steps — trackOpens always OFF, trackClicks only on step 3 (demo link)
  const steps = templates.map((tpl: Record<string, unknown>) => ({
    subject: String(tpl.subject ?? ''),
    body: String(tpl.body_text ?? ''),
    delayDays: Number(tpl.delay_days ?? 0),
    trackOpens: false,
    trackClicks: Number(tpl.step_number) === 3,
  }))

  // Create in Instantly
  const apiKey = process.env.INSTANTLY_API_KEY
  if (!apiKey) {
    return errorResponse('INSTANTLY_API_KEY not configured', 500)
  }

  const instantly = new InstantlyClient(apiKey)
  const name = campaignName || `Cold ${sequenceId} — ${new Date().toISOString().slice(0, 10)}`

  try {
    const campaign = await instantly.createCampaign({
      name,
      emailAccountIds,
      steps,
      stopOnReply: true,
      stopOnAutoReply: false,
      dailyLimit: 12,
      sendWindow: {
        startHour: 8,
        endHour: 16,
        weekdaysOnly: true,
        timezone: 'America/Toronto',
      },
    })

    // Persist in email_campaigns
    await admin
      .from('email_campaigns')
      .insert({
        name,
        instantly_campaign_id: campaign.id,
        status: 'active',
        sequence_steps: steps,
        created_at: new Date().toISOString(),
      } as never)

    return jsonResponse({
      campaignId: campaign.id,
      name,
      steps: steps.length,
      message: `Campaign "${name}" created with ${steps.length} steps`,
    })
  } catch (err) {
    return errorResponse(
      `Instantly campaign creation failed: ${err instanceof Error ? err.message : 'unknown'}`,
      500
    )
  }
})
