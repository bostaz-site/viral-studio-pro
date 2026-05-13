import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
let cachedInsights: { data: string[]; at: number } | null = null

// GET — AI insights (cached 1h)
export const GET = withAdmin(async () => {
  // Return cache if fresh
  if (cachedInsights && Date.now() - cachedInsights.at < CACHE_TTL_MS) {
    return jsonResponse({ insights: cachedInsights.data, cached: true })
  }

  try {
    const supabase = createAdminClient()

    // Gather stats for Claude
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const [
      thisWeekSent, prevWeekSent,
      thisWeekReplies, prevWeekReplies,
      thisWeekSignups, prevWeekSignups,
      thisWeekBounces, payingCount,
    ] = await Promise.all([
      supabase.from('email_events').select('id', { count: 'exact', head: true }).eq('event_type', 'sent').gte('occurred_at', sevenDaysAgo),
      supabase.from('email_events').select('id', { count: 'exact', head: true }).eq('event_type', 'sent').gte('occurred_at', fourteenDaysAgo).lt('occurred_at', sevenDaysAgo),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').gte('created_at', sevenDaysAgo),
      supabase.from('email_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').gte('created_at', fourteenDaysAgo).lt('created_at', sevenDaysAgo),
      supabase.from('product_activation_events').select('id', { count: 'exact', head: true }).eq('event_name', 'user_signed_up').gte('occurred_at', sevenDaysAgo),
      supabase.from('product_activation_events').select('id', { count: 'exact', head: true }).eq('event_name', 'user_signed_up').gte('occurred_at', fourteenDaysAgo).lt('occurred_at', sevenDaysAgo),
      supabase.from('email_events').select('id', { count: 'exact', head: true }).in('event_type', ['bounced_hard', 'bounced_soft']).gte('occurred_at', sevenDaysAgo),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('plan', ['pro', 'studio']),
    ])

    const stats = {
      emails_sent_this_week: thisWeekSent.count ?? 0,
      emails_sent_prev_week: prevWeekSent.count ?? 0,
      replies_this_week: thisWeekReplies.count ?? 0,
      replies_prev_week: prevWeekReplies.count ?? 0,
      signups_this_week: thisWeekSignups.count ?? 0,
      signups_prev_week: prevWeekSignups.count ?? 0,
      bounces_this_week: thisWeekBounces.count ?? 0,
      paying_users: payingCount.count ?? 0,
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return jsonResponse({ insights: ['Claude API key not configured'], cached: false })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Voici les stats Viral Animal des 7 derniers jours vs semaine precedente. Genere 2-3 insights actionnables courts. 1 phrase par insight. Pas de markdown. Pas de bullet points. Retourne uniquement un JSON array de strings.

Data: ${JSON.stringify(stats)}

Retourne UNIQUEMENT un JSON array: ["insight 1", "insight 2", "insight 3"]`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return jsonResponse({ insights: ['AI insights temporarily unavailable'], cached: false })
    }

    const result = await res.json()
    const text = result.content?.[0]?.text ?? '[]'
    const insights: string[] = JSON.parse(text)

    cachedInsights = { data: insights, at: Date.now() }
    return jsonResponse({ insights, cached: false })
  } catch {
    return jsonResponse({ insights: ['Unable to generate insights right now'], cached: false })
  }
})
