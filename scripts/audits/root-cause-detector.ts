/**
 * Root Cause Detector — runs DAILY at end of nightly
 *
 * Compresses N open findings into M root cause clusters.
 * Uses Claude Opus for rigorous analysis.
 *
 * 1. Fetch ALL open findings from last 7 days
 * 2. Ask Claude to cluster by root cause (max 10)
 * 3. Insert clusters into root_cause_clusters table
 * 4. Link findings to their cluster via root_cause_cluster_id
 * 5. Generate one prompt per cluster, push to GitHub
 * 6. Discord summary
 *
 * Run: npx tsx scripts/audits/root-cause-detector.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { pushFileToGitHub } from '../../lib/audit/github-push'

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

interface RawCluster {
  cluster_name: string
  root_cause: string
  finding_indexes: number[]
  estimated_effort_hours: number
  estimated_impact: number
  confidence: number
  prompt_markdown: string
}

export async function runRootCauseDetector() {
  const admin = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Fetch all open findings from last 7 days
  const { data: findings } = await admin
    .from('audit_findings')
    .select('id, severity, agent_type, title, description, location, suggested_fix, cycle_count, created_at')
    .eq('status', 'open')
    .gte('created_at', sevenDaysAgo)
    .order('severity', { ascending: true })
    .limit(200)

  if (!findings || findings.length < 3) {
    console.log(`[root-cause] Only ${findings?.length ?? 0} open findings, skipping (need >=3)`)
    return
  }

  console.log(`[root-cause] Analyzing ${findings.length} open findings for root causes...`)

  // 2. Ask Claude Opus to cluster by root cause
  const response = await claude.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16384,
    messages: [{
      role: 'user',
      content: `You are a senior staff engineer who spent 10 years debugging production systems at Stripe and Linear. You know that 80% of findings come from 20% of root causes.

Here are ${findings.length} open audit findings from viralanimal.com (a video editing SaaS):

${findings.map((f, i) => `[${i}] [${f.severity.toUpperCase()}] ${f.agent_type} | ${f.title}
  ${f.description}
  Location: ${f.location || 'N/A'}
  Fix: ${f.suggested_fix || 'N/A'}`).join('\n\n')}

TASK: Cluster these findings by ROOT CAUSE. A root cause is a single underlying issue that, when fixed, resolves multiple findings at once.

Rules:
- Max 10 clusters
- Every finding MUST be assigned to exactly one cluster (no orphans unless truly unique)
- Prioritize clusters that compress the most findings (the whole point is compression)
- For each cluster, generate a Claude Code prompt that fixes the root cause
- The prompt must be self-contained, specific (file paths), and include Definition of Done + commit message

Output ONLY JSON:
{
  "clusters": [
    {
      "cluster_name": "Short descriptive name",
      "root_cause": "1-2 sentence root cause explanation",
      "finding_indexes": [0, 3, 7, 12, ...],
      "estimated_effort_hours": 3,
      "estimated_impact": 9,
      "confidence": 8,
      "prompt_markdown": "# Fix: Cluster Name\\n\\n## Context\\n..."
    }
  ]
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[root-cause] Failed to parse Claude response')
    return
  }

  let rawClusters: RawCluster[]
  try {
    const parsed = JSON.parse(jsonMatch[0])
    rawClusters = parsed.clusters ?? []
  } catch (err) {
    console.error('[root-cause] JSON parse error:', err)
    return
  }

  if (rawClusters.length === 0) {
    console.log('[root-cause] No clusters returned')
    return
  }

  // Cap at 10
  if (rawClusters.length > 10) {
    rawClusters = rawClusters.slice(0, 10)
  }

  console.log(`[root-cause] ${findings.length} findings compressed into ${rawClusters.length} root causes`)

  // 3. Insert clusters + link findings
  const dateStr = new Date().toISOString().slice(0, 10)
  const insertedClusters: Array<{ id: string; name: string; count: number; githubUrl: string }> = []

  // Clear old clusters from today (idempotent re-runs)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  await admin
    .from('root_cause_clusters')
    .delete()
    .gte('created_at', todayStart.toISOString())

  for (let i = 0; i < rawClusters.length; i++) {
    const rc = rawClusters[i]
    const findingIds = rc.finding_indexes
      .filter((idx) => idx >= 0 && idx < findings.length)
      .map((idx) => findings[idx].id)

    if (findingIds.length === 0) continue

    const totalSeverity = rc.finding_indexes
      .filter((idx) => idx >= 0 && idx < findings.length)
      .reduce((sum, idx) => sum + (SEVERITY_WEIGHT[findings[idx].severity] ?? 1), 0)

    // Insert cluster
    const { data: cluster } = await admin
      .from('root_cause_clusters')
      .insert({
        cluster_name: rc.cluster_name,
        root_cause_description: rc.root_cause,
        impact_summary: `Fixing this resolves ${findingIds.length} findings`,
        finding_ids: findingIds,
        findings_count: findingIds.length,
        total_severity_score: totalSeverity,
        estimated_effort_hours: rc.estimated_effort_hours,
        estimated_impact: Math.min(10, Math.max(1, rc.estimated_impact)),
        confidence_score: Math.min(10, Math.max(1, rc.confidence)),
      })
      .select('id')
      .single()

    if (!cluster) continue

    // Link findings to cluster
    await admin
      .from('audit_findings')
      .update({ root_cause_cluster_id: cluster.id })
      .in('id', findingIds)

    // Push prompt to GitHub
    let githubUrl = ''
    if (rc.prompt_markdown) {
      const slug = rc.cluster_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
      const filepath = `claude-code-prompts/auto/${dateStr}/CLUSTER-${i + 1}-${slug}.md`
      try {
        githubUrl = await pushFileToGitHub(
          filepath,
          rc.prompt_markdown,
          `auto: root cause cluster "${rc.cluster_name}" (${findingIds.length} findings)`,
        )
      } catch (err) {
        console.warn(`[root-cause] GitHub push failed for cluster ${i + 1}:`, err)
      }
    }

    insertedClusters.push({
      id: cluster.id,
      name: rc.cluster_name,
      count: findingIds.length,
      githubUrl,
    })

    console.log(`[root-cause] Cluster ${i + 1}: "${rc.cluster_name}" — ${findingIds.length} findings, impact=${rc.estimated_impact}, effort=${rc.estimated_effort_hours}h`)
  }

  // 4. Count orphans (findings not assigned to any cluster)
  const assignedIds = new Set(rawClusters.flatMap((rc) =>
    rc.finding_indexes.filter((idx) => idx >= 0 && idx < findings.length).map((idx) => findings[idx].id)
  ))
  const orphanCount = findings.length - assignedIds.size

  // 5. Discord notification
  await sendDiscordRootCauses(insertedClusters, findings.length, orphanCount, dateStr)

  console.log(`[root-cause] Done. ${insertedClusters.length} clusters inserted, ${orphanCount} orphans`)
  return { clusters: insertedClusters.length, orphans: orphanCount, total: findings.length }
}

async function sendDiscordRootCauses(
  clusters: Array<{ id: string; name: string; count: number; githubUrl: string }>,
  totalFindings: number,
  orphanCount: number,
  date: string,
) {
  const webhook = process.env.DISCORD_AUDIT_WEBHOOK_URL
  if (!webhook) return

  const fields = clusters.slice(0, 5).map((c, i) => ({
    name: `#${i + 1} ${c.name}`,
    value: `Fixes **${c.count}** findings${c.githubUrl ? `\n[View prompt](${c.githubUrl})` : ''}`,
    inline: true,
  }))

  if (orphanCount > 0) {
    fields.push({
      name: 'Orphans',
      value: `${orphanCount} findings don't fit any cluster`,
      inline: true,
    })
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${totalFindings} findings compressed into ${clusters.length} root causes`,
          description: `Fix these ${clusters.length} root causes to resolve ${totalFindings - orphanCount} findings at once.`,
          color: 0x9B59B6,
          fields,
          footer: { text: 'Viral Animal Audit System' },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
  } catch (err) {
    console.warn('[root-cause] Discord notification failed:', err)
  }
}

// Standalone execution
if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  runRootCauseDetector()
    .then((result) => { console.log('[root-cause] Complete.', result); process.exit(0) })
    .catch((err) => { console.error('[root-cause] Fatal:', err); process.exit(1) })
}
