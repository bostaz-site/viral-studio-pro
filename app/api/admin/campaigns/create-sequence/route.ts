import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { InstantlyClient } from '@/lib/integrations/instantly/client'

const schema = z.object({
  sequenceId: z.string().default('cold-v1'),
  emailAccountIds: z.array(z.string().min(1)).min(1),
  campaignName: z.string().min(3).max(100).optional(),
})

/**
 * POST /api/admin/campaigns/create-sequence
 *
 * Creates an Instantly campaign from email_templates with matching sequence_id.
 * Configures tracking, send window, stop-on-reply per cold email V1 spec.
 */
export const POST = withAdmin(async (req) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const { sequenceId, emailAccountIds, campaignName } = parsed.data
  const admin = createAdminClient()

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

  // Compliance preflight
  const tplBodies = templates.map((t: Record<string, unknown>) => String(t.body_text ?? ''))
  const missingFooter = tplBodies.some(b => !b.includes('unsubscribeLink') && !b.includes('unsubscribe'))
  if (missingFooter) {
    return errorResponse('Compliance: one or more templates missing unsubscribe link in footer', 400)
  }

  // Check bounce rate on active campaigns
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
    if (avgBounce > 3) {
      return errorResponse(`Compliance: avg bounce rate ${avgBounce.toFixed(1)}% exceeds 3% threshold. Pause and re-verify list.`, 400)
    }
  } catch { /* non-critical */ }

  // Build steps
  const steps = templates.map((tpl: Record<string, unknown>, i: number) => ({
    subject: String(tpl.subject ?? ''),
    body: String(tpl.body_text ?? ''),
    delayDays: Number(tpl.delay_days ?? 0),
    trackOpens: false, // OFF — pixel = spam signal
    trackClicks: i === 0 ? false : true, // OFF step 1, ON steps 2-3
  }))

  // Create in Instantly
  const apiKey = process.env.INSTANTLY_API_KEY
  if (!apiKey) {
    return errorResponse('INSTANTLY_API_KEY not configured', 500)
  }

  const instantly = new InstantlyClient(apiKey)
  const name = campaignName || `Cold V1 — ${new Date().toISOString().slice(0, 10)}`

  try {
    const campaign = await instantly.createCampaign({
      name,
      emailAccountIds,
      steps,
      stopOnReply: true,
      sendWindow: { startHour: 8, endHour: 16, weekdaysOnly: true },
    })

    // Persist in email_campaigns
    await admin
      .from('email_campaigns')
      .insert({
        name,
        instantly_campaign_id: campaign.id,
        status: 'active',
        template_id: (templates[0] as Record<string, unknown>).id,
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
