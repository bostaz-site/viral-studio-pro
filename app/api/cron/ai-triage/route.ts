import { NextRequest, NextResponse } from 'next/server'
import { timingSafeCompare } from '@/lib/crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyReply } from '@/lib/admin/ai/reply-classifier'
import { generateReplyDrafts } from '@/lib/admin/ai/reply-drafter'
import { computeLeadScore } from '@/lib/admin/ai/lead-scorer'

const MAX_PER_RUN = 50

/**
 * Cron: AI Triage — auto-classify new inbound replies.
 * Runs every 10 min via Netlify scheduled function.
 * Auth: x-api-key header = CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const apiKey = req.headers.get('x-api-key')
  if (!cronSecret || !apiKey || !timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1. Find unclassified inbound replies (last 48h)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: unclassified } = await admin
    .from('email_messages')
    .select('id, body_text, influencer_id')
    .eq('direction', 'inbound')
    .is('ai_sentiment', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (!unclassified || unclassified.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let classified = 0
  let drafted = 0
  let scored = 0
  const errors: string[] = []

  for (const msg of unclassified) {
    try {
      // Get influencer context
      const { data: influencer } = await admin
        .from('influencers')
        .select('*')
        .eq('id', msg.influencer_id!)
        .single()

      if (!influencer) continue

      const name = influencer.display_name || influencer.first_name || influencer.email?.split('@')[0] || ''

      // 2. Classify
      const classification = await classifyReply({
        messageId: msg.id,
        body: msg.body_text || '',
        influencerName: name,
        platform: influencer.primary_platform || 'unknown',
        niche: influencer.niche || '',
        audienceSize: influencer.audience_size,
      })

      if (classification) {
        // Map neutral_question to neutral for DB constraint
        const dbSentiment = classification.sentiment === 'neutral_question'
          ? 'neutral' : classification.sentiment

        await admin
          .from('email_messages')
          .update({
            ai_sentiment: dbSentiment,
            ai_intent: classification.intent,
            ai_confidence: classification.confidence,
            ai_classified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', msg.id)

        classified++

        // 3. Generate drafts for positive/neutral
        if (classification.sentiment === 'positive' || classification.sentiment === 'neutral_question') {
          const drafts = await generateReplyDrafts({
            messageId: msg.id,
            replyBody: msg.body_text || '',
            influencerName: name,
            platform: influencer.primary_platform || 'unknown',
            niche: influencer.niche || '',
            audienceSize: influencer.audience_size,
            sentiment: classification.sentiment,
          })

          if (drafts) {
            // Store drafts in message metadata (human_response_drafted)
            await admin
              .from('email_messages')
              .update({
                human_response_drafted: JSON.stringify(drafts.drafts),
                updated_at: new Date().toISOString(),
              })
              .eq('id', msg.id)
            drafted++
          }
        }

        // 4. Re-score influencer lead score
        const scoreResult = await computeLeadScore(influencer as Parameters<typeof computeLeadScore>[0])
        await admin
          .from('influencers')
          .update({
            lead_score: scoreResult.score,
            lead_score_reasons: scoreResult.reasons,
            updated_at: new Date().toISOString(),
          })
          .eq('id', influencer.id)
        scored++
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      errors.push(`msg=${msg.id}: ${errMsg}`)
    }
  }

  return NextResponse.json({
    ok: true,
    processed: unclassified.length,
    classified,
    drafted,
    scored,
    errors: errors.slice(0, 10),
  })
}
