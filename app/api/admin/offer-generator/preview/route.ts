import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractVariables } from '@/lib/admin/offer-generator/variable-extractor'
import { renderTemplate, renderSubject } from '@/lib/admin/offer-generator/template-renderer'
import { compliancePreflight } from '@/lib/admin/offer-generator/compliance-preflight'

export const POST = withAdmin(async (req: NextRequest) => {
  const { influencerId, templateId, subjectVariantIndex } = await req.json()
  if (!influencerId || !templateId) return errorResponse('influencerId and templateId required')

  const admin = createAdminClient()
  const { data: template } = await admin.from('offer_templates').select('*').eq('id', templateId).single()
  if (!template) return errorResponse('Template not found', 404)

  const compliance = await compliancePreflight(influencerId)
  const vars = await extractVariables(influencerId)
  const variants = (template.subject_line_variants as string[]) || []
  const idx = subjectVariantIndex ?? 0
  const subject = idx < variants.length ? variants[idx] : variants[0] || ''

  return jsonResponse({
    compliance,
    variables: vars,
    preview: {
      subject: renderSubject(subject, vars),
      body: renderTemplate(template.body_template, vars),
      repostKitUrl: vars.repost_kit_url,
    },
    allSubjectVariants: variants.map((s: string) => renderSubject(s, vars)),
  })
})
