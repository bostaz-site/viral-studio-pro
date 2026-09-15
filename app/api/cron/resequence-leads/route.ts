/**
 * Cron: resequence-leads — moves not_now leads back to cold after 60 days.
 * Schedule: daily via cron-job.org
 * Auth: x-api-key = CRON_SECRET (timingSafeCompare)
 *
 * Selects influencers WHERE reply_bucket='not_now' AND resequence_after <= today
 * AND NOT suppressed AND NOT unsubscribed AND NOT bounced.
 * Sets status='cold', reply_bucket=null, adds 'resequenced' tag.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeCompare } from '@/lib/crypto'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const cronSecret = process.env.CRON_SECRET
  if (!apiKey || !cronSecret || !timingSafeCompare(apiKey, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  try {
    // Find not_now leads ready for re-sequence, excluding suppressed/bounced/unsubscribed
    const { data: leads, error: queryErr } = await admin
      .from('influencers')
      .select('id, email, tags')
      .eq('reply_bucket' as never, 'not_now')
      .lte('resequence_after' as never, today)
      .neq('unsubscribed' as never, true)
      .neq('has_bounced' as never, true)

    if (queryErr) {
      return errorResponse(`Query failed: ${queryErr.message}`, 500)
    }

    if (!leads || leads.length === 0) {
      return jsonResponse({ data: { resequenced: 0 }, error: null })
    }

    // Filter out anyone on the suppression list (4-way check)
    const emails = leads.map((l: Record<string, unknown>) => String(l.email))
    const { data: suppressed } = await admin
      .from('suppression_list')
      .select('email')
      .in('email', emails)

    const suppressedEmails = new Set((suppressed ?? []).map((s: Record<string, unknown>) => String(s.email)))

    const eligible = (leads as Array<Record<string, unknown>>).filter(
      l => !suppressedEmails.has(String(l.email))
    )

    let resequenced = 0

    for (const lead of eligible) {
      const existingTags = (lead.tags as string[] | null) ?? []
      const newTags = existingTags.includes('resequenced')
        ? existingTags
        : [...existingTags, 'resequenced']

      const { error: updateErr } = await admin
        .from('influencers')
        .update({
          status: 'cold',
          status_changed_at: new Date().toISOString(),
          reply_bucket: null,
          resequence_after: null,
          tags: newTags,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', String(lead.id))

      if (!updateErr) resequenced++
    }

    return jsonResponse({ data: { resequenced }, error: null })
  } catch (err) {
    return errorResponse(
      `Resequence failed: ${err instanceof Error ? err.message : 'unknown'}`,
      500
    )
  }
}
