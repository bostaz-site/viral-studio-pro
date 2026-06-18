/**
 * Founder Profile Builder — runs SUNDAY
 *
 * Analyzes founder behavior patterns from the past 7 days:
 * - Cluster accept/later/discard ratios
 * - Time to ship after Accept
 * - Outcome success rates per area
 *
 * Stores insights in founder_profile table.
 *
 * Run: npx tsx scripts/audits/founder-profile-builder.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { safeParseClaudeJson, extractClaudeText } from '../../lib/audit/safe-json'

interface Insight {
  insight_type: 'preference' | 'pattern' | 'risk' | 'strength' | 'anti_pattern'
  insight_text: string
  confidence: number
  derived_from: string
}

export async function runFounderProfileBuilder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Collect behavioral data
  // Findings accepted vs parked vs discarded
  const { data: recentFindings } = await admin
    .from('audit_findings')
    .select('id, agent_type, severity, status, auto_fix_status, accepted_at, created_at, updated_at')
    .gte('created_at', sevenDaysAgo)
    .limit(200)

  const { data: recentClusters } = await admin
    .from('root_cause_clusters')
    .select('id, cluster_name, status, accepted_at, fixed_at, estimated_impact, findings_count')
    .gte('created_at', sevenDaysAgo)
    .limit(50)

  // Outcome measurements
  const { data: outcomes } = await admin
    .from('outcome_measurements')
    .select('predicted_impact_bucket, actual_lift_percent, did_it_work, cluster_id')
    .gte('measured_at', sevenDaysAgo)
    .limit(30)

  // Existing insights (to avoid duplicates)
  const { data: existingInsights } = await admin
    .from('founder_profile')
    .select('insight_text')
    .eq('is_active', true)
    .limit(20)

  const findingsArr = recentFindings ?? []
  const clustersArr = recentClusters ?? []
  const outcomesArr = outcomes ?? []

  if (findingsArr.length === 0 && clustersArr.length === 0) {
    console.log('[founder-profile] No recent data to analyze')
    return
  }

  console.log(`[founder-profile] Analyzing: ${findingsArr.length} findings, ${clustersArr.length} clusters, ${outcomesArr.length} outcomes`)

  // 2. Ask Claude to generate insights
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Analyze this founder's behavior patterns from the last 7 days:

FINDINGS (${findingsArr.length} total):
- Status breakdown: ${JSON.stringify(countBy(findingsArr, 'status'))}
- Severity breakdown: ${JSON.stringify(countBy(findingsArr, 'severity'))}
- Agent type breakdown: ${JSON.stringify(countBy(findingsArr, 'agent_type'))}
- Auto-fix status: ${JSON.stringify(countBy(findingsArr, 'auto_fix_status'))}

CLUSTERS (${clustersArr.length} total):
${clustersArr.map((c: { cluster_name: string; status: string; findings_count: number; estimated_impact: number | null }) =>
  `"${c.cluster_name}" status=${c.status} findings=${c.findings_count} impact=${c.estimated_impact}`).join('\n')}

OUTCOMES (${outcomesArr.length}):
${outcomesArr.map((o: { predicted_impact_bucket: string; actual_lift_percent: number | null; did_it_work: boolean | null }) =>
  `predicted=${o.predicted_impact_bucket} actual=${o.actual_lift_percent?.toFixed(1) ?? '?'}% worked=${o.did_it_work}`).join('\n')}

EXISTING INSIGHTS (avoid duplicating):
${(existingInsights ?? []).map((i: { insight_text: string }) => `- ${i.insight_text}`).join('\n')}

Generate 5-8 NEW insights about this founder's patterns. Types:
- preference: what they prioritize
- pattern: recurring behavior
- risk: things that go wrong
- strength: areas of competence
- anti_pattern: habits to watch out for

Output JSON: { "insights": [{"insight_type": "pattern", "insight_text": "...", "confidence": 7, "derived_from": "cluster_accept_patterns"}] }`,
    }],
  })

  const text = extractClaudeText(response)
  const result = safeParseClaudeJson<{ insights: Insight[] }>(text, { insights: [] })

  // 3. Mark old weekly insights as inactive
  await admin
    .from('founder_profile')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('derived_from', 'weekly_analysis')
    .eq('is_active', true)

  // 4. Insert new insights
  let inserted = 0
  for (const insight of result.insights ?? []) {
    try {
      await admin.from('founder_profile').insert({
        insight_type: insight.insight_type,
        insight_text: insight.insight_text,
        confidence: Math.min(10, Math.max(1, insight.confidence)),
        derived_from: 'weekly_analysis',
      })
      inserted++
    } catch (err) {
      console.warn('[founder-profile] Insert failed:', err)
    }
  }

  console.log(`[founder-profile] Done. ${inserted} new insights generated`)
  return { insights: inserted }
}

function countBy(arr: Array<Record<string, unknown>>, key: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    const val = String(item[key] ?? 'null')
    counts[val] = (counts[val] || 0) + 1
  }
  return counts
}

if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  runFounderProfileBuilder()
    .then((r) => { console.log('[founder-profile] Complete.', r); process.exit(0) })
    .catch((err) => { console.error('[founder-profile] Fatal:', err); process.exit(1) })
}
