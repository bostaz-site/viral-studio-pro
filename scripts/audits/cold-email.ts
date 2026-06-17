/**
 * Cold Email Agent — runs FRIDAYS
 *
 * Persona: "Senior email deliverability expert + growth hacker who ran cold email
 * for Apollo and Lemlist. Obsesses over inbox placement, reply quality, and
 * conversion-to-customer."
 *
 * Audits 4 dimensions (MVP):
 *   1. Domain Health — SPF/DKIM/DMARC, warmup status, blacklist risk
 *   2. Deliverability — open/bounce/reply rates per mailbox
 *   3. Influencer Replies — unanswered positive replies (money on the table)
 *   4. Collab Workflow — reply → promo code sent → used?
 *
 * Run: npx tsx scripts/audits/cold-email.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { insertFinding } from '../../lib/audit/insert-finding'
import { insertMetricSnapshot } from '../../lib/audit/insert-metric'

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY

export async function runColdEmailAudit() {
  console.log('[cold-email] Starting audit...')

  if (!INSTANTLY_API_KEY) {
    console.warn('[cold-email] INSTANTLY_API_KEY not set — skipping Instantly data, using DB only')
  }

  const admin = createAdminClient()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Domain Health ────────────────────────────────────────────────────
  const { data: domains } = await admin
    .from('domains')
    .select('domain, status, spf_configured, dkim_configured, dmarc_configured, warmup_started_at')

  const domainIssues = (domains ?? []).filter(
    (d) => !d.spf_configured || !d.dkim_configured || !d.dmarc_configured || d.status === 'blacklisted'
  )

  // ── 2. Deliverability — mailbox stats last 14 days ──────────────────────
  const { data: mailboxStats } = await admin
    .from('mailbox_daily_stats')
    .select('mailbox_id, stat_date, emails_sent, emails_delivered, emails_opened, emails_replied, emails_bounced, emails_complained')
    .gte('stat_date', fourteenDaysAgo.slice(0, 10))
    .order('stat_date', { ascending: false })

  // Aggregate stats
  const totals = (mailboxStats ?? []).reduce(
    (acc, s) => ({
      sent: acc.sent + (s.emails_sent ?? 0),
      delivered: acc.delivered + (s.emails_delivered ?? 0),
      opened: acc.opened + (s.emails_opened ?? 0),
      replied: acc.replied + (s.emails_replied ?? 0),
      bounced: acc.bounced + (s.emails_bounced ?? 0),
      complained: acc.complained + (s.emails_complained ?? 0),
    }),
    { sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0, complained: 0 }
  )

  const openRate = totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0
  const bounceRate = totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0
  const replyRate = totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0
  const complaintRate = totals.sent > 0 ? (totals.complained / totals.sent) * 100 : 0

  // ── 3. Influencer Replies — unanswered > 48h ───────────────────────────
  // Find inbound messages that have no outbound reply after them
  const { data: recentInbound } = await admin
    .from('email_messages')
    .select('id, influencer_id, subject, body_text, sent_at')
    .eq('direction', 'inbound')
    .gte('sent_at', fourteenDaysAgo)
    .order('sent_at', { ascending: false })
    .limit(50)

  // For each inbound, check if there's a subsequent outbound to the same influencer
  const unansweredReplies: Array<{
    message_id: string
    influencer_id: string
    subject: string | null
    body_preview: string
    received_at: string | null
  }> = []

  for (const msg of recentInbound ?? []) {
    if (!msg.influencer_id || !msg.sent_at) continue

    const { count } = await admin
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .eq('influencer_id', msg.influencer_id!)
      .gt('sent_at', msg.sent_at!)

    if ((count ?? 0) === 0) {
      unansweredReplies.push({
        message_id: msg.id,
        influencer_id: msg.influencer_id,
        subject: msg.subject,
        body_preview: (msg.body_text ?? '').slice(0, 200),
        received_at: msg.sent_at,
      })
    }
  }

  // Enrich with influencer info
  const influencerIds = [...new Set(unansweredReplies.map((r) => r.influencer_id))]
  const { data: influencers } = influencerIds.length > 0
    ? await admin
        .from('influencers')
        .select('id, email, display_name, platform_handle, audience_size, primary_platform')
        .in('id', influencerIds)
    : { data: [] }

  const influencerMap = new Map((influencers ?? []).map((i) => [i.id, i]))

  const enrichedUnanswered = unansweredReplies
    .map((r) => ({
      ...r,
      influencer: influencerMap.get(r.influencer_id) ?? null,
    }))
    .filter((r) => r.received_at && r.received_at < fortyEightHoursAgo)

  // ── 4. Collab Workflow — positive replies without promo code ────────────
  // Check influencers who replied but don't have an affiliate code yet
  const repliedInfluencerIds = enrichedUnanswered
    .filter((r) => r.influencer?.email)
    .map((r) => r.influencer!.id)

  let missingPromoCodes: Array<{ influencer_id: string; email: string; display_name: string | null; audience_size: number | null }> = []

  if (repliedInfluencerIds.length > 0) {
    // Check which of these influencers have affiliate codes
    const { data: existingCodes } = await admin
      .from('affiliate_codes')
      .select('user_id')

    const usersWithCodes = new Set((existingCodes ?? []).map((c) => c.user_id))

    missingPromoCodes = (influencers ?? [])
      .filter((i) => repliedInfluencerIds.includes(i.id) && !usersWithCodes.has(i.id))
      .map((i) => ({
        influencer_id: i.id,
        email: i.email,
        display_name: i.display_name,
        audience_size: i.audience_size,
      }))
  }

  // ── 5. Campaign performance (from DB) ──────────────────────────────────
  const { data: campaigns } = await admin
    .from('email_campaigns')
    .select('id, name, status, total_recipients, total_sent, total_opened, total_replied, total_bounced')
    .in('status', ['running', 'completed'])
    .order('created_at', { ascending: false })
    .limit(10)

  // ── 6. Instantly API data (optional) ───────────────────────────────────
  let instantlyData: Record<string, unknown> | null = null
  if (INSTANTLY_API_KEY) {
    instantlyData = await fetchInstantlyOverview()
  }

  // ── 7. Send to Claude for analysis ─────────────────────────────────────
  const systemPrompt = `You are a senior email deliverability expert + growth hacker who ran cold email for Apollo and Lemlist. You obsess over inbox placement, reply quality, and conversion-to-customer.

You are auditing the cold email machine for viralanimal.com (a video editing SaaS targeting content creators / streamers).

Generate findings (max 5) for the most impactful issues. Prioritize:
- DELIVERABILITY issues (domain auth missing, high bounce rate, blacklist) = CRITICAL
- IGNORED MONEY (positive replies > 48h unanswered, especially from big accounts) = CRITICAL
- CAMPAIGN PERFORMANCE (low open rate < 30%, drop-off in sequences) = HIGH
- WARMING velocity issues = HIGH
- COLLAB WORKFLOW gaps (replied but no promo code sent) = HIGH
- A/B insights worth applying = NORMAL

Output JSON only:
{
  "findings": [
    {
      "severity": "critical" | "high" | "normal" | "low",
      "title": "Short title",
      "description": "What's wrong, why it matters in $ terms when possible",
      "location": "Domain name OR campaign name OR influencer handle",
      "suggested_fix": "Concrete action with deadline if applicable"
    }
  ],
  "metrics": [
    { "name": "cold_email_open_rate_14d", "value": 42.5, "unit": "percentage" },
    { "name": "cold_email_reply_rate_14d", "value": 1.2, "unit": "percentage" },
    { "name": "cold_email_bounce_rate_14d", "value": 0.5, "unit": "percentage" },
    { "name": "cold_email_unanswered_replies", "value": 7, "unit": "count" }
  ]
}

Rules:
- Max 5 findings
- ONLY findings that are actionable today
- If data is empty or no emails sent yet, say so in a finding about "cold email pipeline not yet active"`

  const userPrompt = `DOMAIN HEALTH (${(domains ?? []).length} domains):
${JSON.stringify(domains ?? [], null, 2)}

Domain issues (missing auth or blacklisted): ${domainIssues.length}

DELIVERABILITY (last 14 days):
  Total sent: ${totals.sent}
  Open rate: ${openRate.toFixed(1)}%
  Reply rate: ${replyRate.toFixed(1)}%
  Bounce rate: ${bounceRate.toFixed(1)}%
  Complaint rate: ${complaintRate.toFixed(3)}%

CAMPAIGNS (${(campaigns ?? []).length}):
${JSON.stringify(campaigns ?? [], null, 2)}

UNANSWERED REPLIES > 48h (${enrichedUnanswered.length}):
${JSON.stringify(enrichedUnanswered.slice(0, 15), null, 2)}

REPLIED INFLUENCERS WITHOUT PROMO CODE (${missingPromoCodes.length}):
${JSON.stringify(missingPromoCodes.slice(0, 10), null, 2)}

MAILBOX DAILY STATS (last 14d, ${(mailboxStats ?? []).length} rows):
${JSON.stringify((mailboxStats ?? []).slice(0, 20), null, 2)}

${instantlyData ? `INSTANTLY API DATA:\n${JSON.stringify(instantlyData, null, 2)}` : 'INSTANTLY API: not connected (no API key)'}`

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"findings":[],"metrics":[]}')

  // Insert findings
  for (const finding of json.findings ?? []) {
    await insertFinding({
      agent_type: 'cold_email',
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      location: finding.location,
      suggested_fix: finding.suggested_fix,
    })
  }

  // Insert metrics
  for (const metric of json.metrics ?? []) {
    await insertMetricSnapshot({
      metric_name: metric.name,
      metric_value: metric.value,
      metric_unit: metric.unit,
      regression_threshold_percent: 15,
    })
  }

  // Record standard deliverability metrics even if Claude doesn't return them
  if (totals.sent > 0) {
    await insertMetricSnapshot({ metric_name: 'cold_email_open_rate_14d', metric_value: parseFloat(openRate.toFixed(1)), metric_unit: 'percentage', regression_threshold_percent: 15 })
    await insertMetricSnapshot({ metric_name: 'cold_email_reply_rate_14d', metric_value: parseFloat(replyRate.toFixed(1)), metric_unit: 'percentage', regression_threshold_percent: 20 })
    await insertMetricSnapshot({ metric_name: 'cold_email_bounce_rate_14d', metric_value: parseFloat(bounceRate.toFixed(1)), metric_unit: 'percentage' })
  }
  await insertMetricSnapshot({ metric_name: 'cold_email_unanswered_48h', metric_value: enrichedUnanswered.length, metric_unit: 'count' })

  console.log(`[cold-email] Done. ${(json.findings ?? []).length} findings. Open: ${openRate.toFixed(1)}%, Reply: ${replyRate.toFixed(1)}%, Unanswered: ${enrichedUnanswered.length}`)
}

// ── Instantly API helpers ──────────────────────────────────────────────────

async function fetchInstantlyOverview(): Promise<Record<string, unknown> | null> {
  try {
    const [campaignsRes, analyticsRes] = await Promise.all([
      fetch('https://api.instantly.ai/api/v2/campaigns?limit=10', {
        headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
      }),
      fetch('https://api.instantly.ai/api/v2/analytics/campaign/summary', {
        headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
      }),
    ])

    const campaigns = campaignsRes.ok ? await campaignsRes.json() : null
    const analytics = analyticsRes.ok ? await analyticsRes.json() : null

    return { campaigns: campaigns?.items ?? [], analytics }
  } catch (err) {
    console.warn('[cold-email] Instantly API call failed:', err)
    return null
  }
}

// Allow standalone execution
if (typeof require !== 'undefined' && require.main === module) {
  runColdEmailAudit()
    .then(() => { console.log('[cold-email] Complete.'); process.exit(0) })
    .catch((err) => { console.error('[cold-email] Fatal:', err); process.exit(1) })
}
