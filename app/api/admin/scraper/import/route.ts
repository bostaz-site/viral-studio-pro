import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { getScraperDb } from '@/lib/admin/scraper/db'
import { createAdminClient } from '@/lib/supabase/admin'

const importSchema = z.object({
  result_ids: z.array(z.string().uuid()).min(1).max(200),
})

// POST — bulk import discovery results to CRM (influencers table)
export const POST = withAdmin(async (req, user) => {
  const body = await req.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const db = getScraperDb()
  const supabase = db // untyped — new tables not in generated types yet

  const { data: results } = await db
    .from('lead_discovery_results')
    .select('*')
    .in('id', parsed.data.result_ids)
    .eq('import_status', 'pending')

  if (!results?.length) return errorResponse('No pending results found')

  let imported = 0
  let skippedDuplicate = 0
  let skippedSuppressed = 0
  let skippedNoEmail = 0

  for (const result of results) {
    // 4-way suppression check
    const isSuppressed = await checkSuppression(supabase, result)
    if (isSuppressed) {
      await supabase
        .from('lead_discovery_results')
        .update({ import_status: 'suppressed', skip_reason: 'suppressed' })
        .eq('id', result.id)
      skippedSuppressed++
      continue
    }

    // Check duplicate by platform handle
    if (result.platform_handle) {
      const { data: existing } = await supabase
        .from('influencers')
        .select('id')
        .eq('platform_handle', result.platform_handle)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('lead_discovery_results')
          .update({ import_status: 'duplicate', skip_reason: 'duplicate_handle', influencer_id: existing.id })
          .eq('id', result.id)
        skippedDuplicate++
        continue
      }
    }

    // Check duplicate by email
    if (result.email) {
      const { data: existing } = await supabase
        .from('influencers')
        .select('id')
        .eq('email', result.email)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('lead_discovery_results')
          .update({ import_status: 'duplicate', skip_reason: 'duplicate_email', influencer_id: existing.id })
          .eq('id', result.id)
        skippedDuplicate++
        continue
      }
    }

    if (!result.email) {
      // No email — add to high-intent DM bucket if score > 40
      if (result.keyword_score > 40) {
        await db.from('high_intent_no_email').upsert({
          discovery_result_id: result.id,
          platform: result.platform,
          platform_handle: result.platform_handle ?? 'unknown',
          display_name: result.display_name,
          profile_url: result.profile_url,
          audience_size: result.audience_size,
          keyword_score: result.keyword_score,
          promoted_products: result.promoted_products,
          reason: 'no_public_email',
        }, { onConflict: 'platform,platform_handle' })
      }
      await supabase
        .from('lead_discovery_results')
        .update({ import_status: 'skipped', skip_reason: 'no_email' })
        .eq('id', result.id)
      skippedNoEmail++
      continue
    }

    // INSERT into influencers
    const { data: influencer } = await supabase
      .from('influencers')
      .insert({
        email: result.email,
        display_name: result.display_name,
        platform_handle: result.platform_handle,
        primary_platform: result.platform as any,
        audience_size: result.audience_size,
        niche: result.niche,
        language: result.language ?? 'en',
        country: result.country,
        status: 'cold',
        source: `scraper_${result.platform}`,
        lead_score: result.keyword_score,
        tags: result.promoted_products?.length ? ['has_competitor_products'] : [],
      })
      .select('id')
      .single()

    if (influencer) {
      // Save contact point with provenance
      if (result.email_source_url) {
        await db.from('public_contact_points').insert({
          discovery_result_id: result.id,
          influencer_id: influencer.id,
          type: 'email',
          value: result.email,
          source_url: result.email_source_url,
          source_context: 'YouTube channel About page',
          is_business_contact: true,
          confidence: 0.90,
        }).catch(() => {}) // ignore duplicates
      }

      // Save promoted products
      if (result.promoted_products?.length) {
        for (const product of result.promoted_products) {
          await db.from('promoted_products').insert({
            influencer_id: influencer.id,
            discovery_result_id: result.id,
            product_name: product,
            evidence_url: result.profile_url,
          }).catch(() => {}) // ignore duplicates
        }
      }

      await supabase
        .from('lead_discovery_results')
        .update({ import_status: 'imported', influencer_id: influencer.id })
        .eq('id', result.id)

      imported++
    }
  }

  return jsonResponse({
    imported,
    skipped_duplicate: skippedDuplicate,
    skipped_suppressed: skippedSuppressed,
    skipped_no_email: skippedNoEmail,
    total: results.length,
  })
})

// 4-way suppression check
async function checkSuppression(supabase: any, result: any): Promise<boolean> {
  const checks = []

  if (result.email) {
    checks.push(
      supabase.from('suppression_list').select('id').eq('email', result.email).maybeSingle(),
      supabase.from('suppression_list').select('id').eq('email_domain', result.email.split('@')[1]).maybeSingle(),
    )
  }

  const results = await Promise.all(checks)
  return results.some(r => r.data !== null)
}
