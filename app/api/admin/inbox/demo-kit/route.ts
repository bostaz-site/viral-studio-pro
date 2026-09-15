import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAffiliateCode } from '@/lib/admin/affiliate-code'

const schema = z.object({
  influencerId: z.string().uuid(),
})

/**
 * POST /api/admin/inbox/demo-kit
 *
 * Generates a demo kit draft for an interested influencer.
 * Contains: demo_clip_url or niche demo, affiliate code, 5-clips-free offer.
 * Uses founder tone (short, direct, matching lead language).
 * Returns draft — does NOT send. Sending is a second explicit click.
 */
export const POST = withAdmin(async (req) => {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const { data: influencer, error: infErr } = await db
    .from('influencers')
    .select('id, email, first_name, display_name, language, niche, platform_handle, affiliate_code, notes, reply_bucket, channel_name')
    .eq('id', parsed.data.influencerId)
    .single()

  if (infErr || !influencer) {
    return errorResponse('Influencer not found', 404)
  }

  // Generate affiliate code if missing
  let affiliateCode = influencer.affiliate_code as string | null
  if (!affiliateCode) {
    affiliateCode = await generateAffiliateCode(influencer.id)
  }

  // Find demo clip URL from notes or fall back to niche demo
  let demoUrl: string | null = null
  try {
    const notes = typeof influencer.notes === 'string'
      ? JSON.parse(influencer.notes)
      : influencer.notes
    demoUrl = notes?.demo_clip_url ?? null
  } catch { /* not JSON */ }

  if (!demoUrl) {
    // Try to find a niche demo from promo_videos
    const niche = (influencer.niche as string) || 'gaming'
    const { data: promoVideo } = await db
      .from('promo_videos')
      .select('public_url')
      .eq('niche', niche)
      .limit(1)
      .single()
    demoUrl = promoVideo?.public_url ?? null
  }

  // Generate draft via Claude Haiku with founder tone
  const name = (influencer.first_name as string) || (influencer.display_name as string) || 'there'
  const lang = (influencer.language as string) === 'fr' ? 'French' : 'English'
  const portalUrl = `https://viralanimal.com/partner?code=${affiliateCode}`

  const draft = await generateDemoKitDraft({
    name,
    language: lang,
    demoUrl,
    affiliateCode: affiliateCode ?? '',
    portalUrl,
    niche: (influencer.niche as string) || 'content',
  })

  return jsonResponse({
    subject: `re: ${(influencer.platform_handle as string) || (influencer.display_name as string) || ''} clips`,
    body: draft,
    demoUrl,
    affiliateCode,
  })
})

async function generateDemoKitDraft(params: {
  name: string
  language: string
  demoUrl: string | null
  affiliateCode: string
  portalUrl: string
  niche: string
}): Promise<string> {
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are Samy, founder of Viral Animal. Write a short, direct reply in ${params.language}.
Tone: casual, genuine, no hype, no exclamation marks, under 60 words.
Include these elements naturally:
1. ${params.demoUrl ? `Here's a clip I made from your content: ${params.demoUrl}` : 'Offer to make a demo clip from their latest video'}
2. Affiliate code: ${params.affiliateCode} (5 free clips this week)
3. Partner portal: ${params.portalUrl}
Output ONLY the email body, no subject line.`,
      messages: [{ role: 'user', content: `Draft a demo kit reply for ${params.name}, a ${params.niche} creator.` }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text || fallbackDraft(params)
  } catch {
    return fallbackDraft(params)
  }
}

function fallbackDraft(params: {
  name: string
  demoUrl: string | null
  affiliateCode: string
  portalUrl: string
}): string {
  const demoLine = params.demoUrl
    ? `Here's a clip I cut from your content: ${params.demoUrl}`
    : `I'll cut a clip from your latest video and send it over.`
  return `${params.name},

${demoLine}

Use code ${params.affiliateCode} for 5 free clips this week. Your partner portal: ${params.portalUrl}

Samy
Viral Animal`
}
