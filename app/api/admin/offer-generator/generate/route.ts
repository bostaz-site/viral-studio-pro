import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractVariables } from '@/lib/admin/offer-generator/variable-extractor'
import { renderTemplate, renderSubject } from '@/lib/admin/offer-generator/template-renderer'
import { pickSubjectVariant } from '@/lib/admin/offer-generator/subject-picker'
import { compliancePreflight } from '@/lib/admin/offer-generator/compliance-preflight'
import { generateAffiliateCode } from '@/lib/admin/affiliate-code'

export const POST = withAdmin(async (req: NextRequest) => {
  const { influencerIds, templateId } = await req.json()
  if (!influencerIds?.length) return errorResponse('influencerIds required')
  if (!templateId) return errorResponse('templateId required')

  const admin = createAdminClient()
  const { data: template } = await admin.from('offer_templates').select('*').eq('id', templateId).single()
  if (!template) return errorResponse('Template not found', 404)

  const variants = (template.subject_line_variants as string[]) || []
  let generated = 0, blocked = 0, failed = 0, needsReviewCount = 0

  for (const influencerId of influencerIds) {
    try {
      const compliance = await compliancePreflight(influencerId)
      if (!compliance.allowed) {
        blocked++
        await admin.from('generated_offers').insert({
          influencer_id: influencerId, template_id: templateId,
          passed_compliance: false, compliance_blocks: compliance.blocks, status: 'failed',
        })
        continue
      }

      // Ensure influencer has an affiliate_code before rendering template
      await ensureAffiliateCode(influencerId)

      const vars = await extractVariables(influencerId)
      const { index, subject: rawSubject } = pickSubjectVariant(variants, (template.total_sent || 0) + generated)
      const renderedSubject = renderSubject(rawSubject, vars)
      const renderedBody = renderTemplate(template.body_template, vars)

      // Flag low-personalization offers: both compliment AND topic are fallbacks
      const needsReview = vars._is_compliment_fallback && vars._is_recent_topic_fallback

      // Include ai_recommended_offer_angle in variables_used for admin preview
      const variablesUsed = {
        ...vars,
        _ai_recommended_offer_angle: vars._ai_recommended_offer_angle ?? undefined,
      }

      await admin.from('generated_offers').insert({
        influencer_id: influencerId, template_id: templateId,
        selected_subject_variant: index, rendered_subject: renderedSubject, rendered_body: renderedBody,
        repost_kit_url: vars.repost_kit_url, variables_used: variablesUsed as unknown as Record<string, string>,
        passed_compliance: true, status: 'draft',
        needs_review: needsReview,
      })
      generated++
      if (needsReview) needsReviewCount++
    } catch (err) {
      console.error(`[offer-generator] Failed for ${influencerId}:`, err)
      failed++
    }
  }

  return jsonResponse({ generated, blocked, failed, needs_review: needsReviewCount, total: influencerIds.length })
})

async function ensureAffiliateCode(influencerId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('influencers')
    .select('affiliate_code, platform_handle')
    .eq('id', influencerId)
    .single()

  if (!data || data.affiliate_code) return

  const code = await generateAffiliateCode(influencerId, data.platform_handle)
  await admin
    .from('influencers')
    .update({ affiliate_code: code })
    .eq('id', influencerId)
}
