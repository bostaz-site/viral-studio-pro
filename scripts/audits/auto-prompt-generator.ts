/**
 * Auto-Prompt Generator (with Fix / Improve / Add classification)
 *
 * 1. Reads all open findings from the last 24h
 * 2. Classifies each as FIX / IMPROVE / ADD via Claude
 * 3. FIX findings → clustered into Claude Code prompts (urgent, daily)
 * 4. IMPROVE findings → inserted into improvement_backlog (batched weekly)
 * 5. ADD findings → logged, skipped (Strategic Agent handles these)
 * 6. FIX prompts saved to claude-code-prompts/auto/<date>/, committed, pushed
 * 7. Discord notification
 *
 * Run: npx tsx scripts/audits/auto-prompt-generator.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { pushFileToGitHub } from '../../lib/audit/github-push'
import { isTikTokReviewMode } from '../../lib/audit/tiktok-review-mode'
import { safeParseClaudeJson, extractClaudeText } from '../../lib/audit/safe-json'
import { sendBotMessage, type DiscordActionRow } from '../../lib/audit/discord'

interface Classification {
  finding_index: number
  category: 'FIX' | 'IMPROVE' | 'ADD'
  improve_impact?: number
  improve_effort?: number
  improve_category?: string
}

interface Cluster {
  name: string
  root_cause: string
  findings_addressed: number[]
  estimated_hours: number
  priority: number
  prompt_markdown: string
  github_url?: string
}

interface Finding {
  id: string
  severity: string
  agent_type: string
  title: string
  description: string
  location: string | null
  suggested_fix: string | null
  cycle_count: number
}

export async function runAutoPromptGenerator() {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fetch ALL open findings from last 24h (not just critical/high)
  const { data: findings } = await admin
    .from('audit_findings')
    .select('*')
    .gte('created_at', since)
    .eq('status', 'open')
    .order('severity', { ascending: true })
    .limit(40)

  if (!findings || findings.length === 0) {
    console.log('[auto-prompt] No new findings in last 24h, skipping')
    return { fixClusters: [], improvesAdded: 0, addsSkipped: 0 }
  }

  console.log(`[auto-prompt] Found ${findings.length} findings to classify`)

  // ── Step 1: Classify each finding as FIX / IMPROVE / ADD ──
  const classifyResponse = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Classify each audit finding below as:
- "FIX" — bug, regression, broken behavior that blocks users (critical/high severity almost always)
- "IMPROVE" — polish, optimization, conversion lift, UX refinement (rarely critical, usually normal/low)
- "ADD" — genuinely new feature suggestion (not a fix or improvement to existing features)

For IMPROVE items, also rate:
- impact (1-10, how much it would improve user experience or conversion)
- effort (1-10, estimated implementation effort)
- category: one of "ux", "perf", "copy", "conversion", "retention"

Output ONLY JSON:
{
  "classifications": [
    {"finding_index": 0, "category": "FIX"},
    {"finding_index": 1, "category": "IMPROVE", "improve_impact": 8, "improve_effort": 3, "improve_category": "conversion"},
    {"finding_index": 2, "category": "ADD"}
  ]
}

Findings:
${findings.map((f: Finding, i: number) => `[${i}] [${f.severity.toUpperCase()}] ${f.agent_type} | ${f.title}
  Description: ${f.description}
  Location: ${f.location || 'N/A'}`).join('\n\n')}`,
    }],
  })

  const classifyText = extractClaudeText(classifyResponse)
  console.log(`[auto-prompt] Classification response: ${classifyText.length} chars`)
  const classifyResult = safeParseClaudeJson<{ classifications: Classification[] }>(classifyText, { classifications: [] })
  let classifications = classifyResult.classifications ?? []
  if (classifications.length === 0) {
    console.warn('[auto-prompt] Classification empty, treating all as FIX')
    classifications = findings.map((_: Finding, i: number) => ({ finding_index: i, category: 'FIX' as const }))
  }

  // Split findings by classification
  const fixFindings: Finding[] = []
  const improveFindings: Array<{ finding: Finding; impact: number; effort: number; category: string }> = []
  let addsSkipped = 0

  for (const c of classifications) {
    const finding = findings[c.finding_index]
    if (!finding) continue

    if (c.category === 'FIX') {
      fixFindings.push(finding)
    } else if (c.category === 'IMPROVE') {
      improveFindings.push({
        finding,
        impact: c.improve_impact ?? 5,
        effort: c.improve_effort ?? 5,
        category: c.improve_category ?? 'ux',
      })
    } else {
      addsSkipped++
    }
  }

  console.log(`[auto-prompt] Classification: ${fixFindings.length} FIX, ${improveFindings.length} IMPROVE, ${addsSkipped} ADD (skipped)`)

  // ── Step 2: Insert IMPROVE findings into improvement_backlog ──
  for (const item of improveFindings) {
    try {
      await admin.from('improvement_backlog').insert({
        finding_ids: [item.finding.id],
        title: item.finding.title,
        description: item.finding.description + (item.finding.suggested_fix ? `\n\nSuggested fix: ${item.finding.suggested_fix}` : ''),
        predicted_impact_score: item.impact,
        predicted_effort_score: item.effort,
        category: item.category,
      })
    } catch (err) {
      console.warn(`[auto-prompt] Failed to insert improvement "${item.finding.title}":`, err)
    }
  }
  if (improveFindings.length > 0) {
    console.log(`[auto-prompt] Added ${improveFindings.length} items to improvement_backlog`)
  }

  // ── Step 3: Cluster FIX findings into Claude Code prompts ──
  let clusters: Cluster[] = []

  if (fixFindings.length > 0) {
    const clusterResponse = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `You are a senior engineering manager at a fast-moving SaaS startup.

Here are ${fixFindings.length} FIX-classified audit findings from last night's review of viralanimal.com (a video editing SaaS for creators):

${fixFindings.map((f: Finding, i: number) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.agent_type} | ${f.title}
   ID: ${f.id}
   Location: ${f.location || 'N/A'}
   Description: ${f.description}
   Suggested fix: ${f.suggested_fix || 'N/A'}
   Cycle count: ${f.cycle_count}`).join('\n\n')}

Your job:
1. Cluster these findings by ROOT CAUSE (max 4 clusters, prioritize impact x effort)
2. For each cluster, generate a complete Claude Code prompt that fixes ALL findings in that cluster at once
3. The prompts must be:
   - Specific (mention exact file paths from "location" field)
   - Actionable (no vague advice — include code snippets where helpful)
   - Self-contained (Claude Code starts a fresh session — explain context)
   - Include a "## Definition of Done" checklist
   - Include a "## Commit message" line
   - Reference the original audit finding IDs
   - Start with "# " title

Output ONLY this JSON, no prose:
{
  "clusters": [
    {
      "name": "Short cluster title (2-4 words)",
      "root_cause": "1-sentence root cause",
      "findings_addressed": [1, 3, 7],
      "estimated_hours": 2,
      "priority": 1,
      "prompt_markdown": "# Title\\n\\n## Context\\n\\n..."
    }
  ]
}`,
      }],
    })

    const clusterText = extractClaudeText(clusterResponse)
    console.log(`[auto-prompt] Cluster response: ${clusterText.length} chars`)
    const clusterResult = safeParseClaudeJson<{ clusters: Cluster[] }>(clusterText, { clusters: [] })
    clusters = clusterResult.clusters ?? []
  }

  // ── Step 4: Push FIX prompts to GitHub via Contents API ──
  const dateStr = new Date().toISOString().slice(0, 10)

  if (clusters.length > 0) {
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      const slug = cluster.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
      const filename = `PROMPT-${i + 1}-${slug}.md`
      const filepath = `claude-code-prompts/auto/${dateStr}/${filename}`

      try {
        cluster.github_url = await pushFileToGitHub(
          filepath,
          cluster.prompt_markdown,
          `auto: ${cluster.name} prompt for ${dateStr} audit`,
        )
        console.log(`[auto-prompt] Pushed ${filename} (priority ${cluster.priority}, est. ${cluster.estimated_hours}h, ${cluster.findings_addressed.length} findings)`)
      } catch (err) {
        console.error(`[auto-prompt] Failed to push ${filename}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  // ── Step 5: Discord notification ──
  await sendDiscordSummary(clusters, improveFindings.length, addsSkipped, dateStr)

  return { fixClusters: clusters, improvesAdded: improveFindings.length, addsSkipped }
}

async function sendDiscordSummary(
  clusters: Cluster[],
  improvesAdded: number,
  addsSkipped: number,
  date: string,
) {
  const channelId = process.env.DISCORD_CRITICAL_ALERTS_CHANNEL_ID
  if (!channelId && !process.env.DISCORD_AUDIT_WEBHOOK_URL) return

  const repoUrl = 'https://github.com/bostaz-site/viral-studio-pro'

  const fields: Array<{ name: string; value: string; inline: boolean }> = []

  // FIX clusters
  for (let i = 0; i < Math.min(clusters.length, 4); i++) {
    const c = clusters[i]
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    const promptUrl = c.github_url || `${repoUrl}/blob/master/claude-code-prompts/auto/${date}/PROMPT-${i + 1}-${slug}.md`
    fields.push({
      name: `FIX P${c.priority}: ${c.name}`,
      value: `${c.root_cause}\n${c.findings_addressed.length} findings | ~${c.estimated_hours}h\n[View prompt](${promptUrl})`,
      inline: false,
    })
  }

  if (improvesAdded > 0) {
    fields.push({
      name: 'IMPROVE',
      value: `${improvesAdded} items added to backlog. Next batch ships Wednesday.`,
      inline: true,
    })
  }

  if (addsSkipped > 0) {
    fields.push({
      name: 'ADD',
      value: `${addsSkipped} feature suggestions logged (see Monday Strategic Brief)`,
      inline: true,
    })
  }

  // Build interactive button rows (max 5 action rows per Discord message)
  const components: DiscordActionRow[] = []
  for (let i = 0; i < Math.min(clusters.length, 5); i++) {
    const c = clusters[i]
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    const promptId = `${date}-${i + 1}-${slug}`
    components.push({
      type: 1,
      components: [
        { type: 2, style: 3, label: `Accept #${i + 1}`, custom_id: `accept_prompt:${promptId}` },
        { type: 2, style: 2, label: 'Later', custom_id: `later_prompt:${promptId}` },
        { type: 2, style: 4, label: 'Discard', custom_id: `discard_prompt:${promptId}` },
      ],
    })
  }

  const tikTokActive = isTikTokReviewMode()
  const tikTokWarning = tikTokActive
    ? '\n\n**TIKTOK REVIEW MODE ACTIVE** — Accepts are QUEUED, not executed.'
    : ''

  try {
    await sendBotMessage(channelId || '', {
      embeds: [{
        title: clusters.length > 0
          ? `${clusters.length} fix prompts ready${tikTokActive ? ' (queued)' : ''} + ${improvesAdded} improvements queued`
          : `${improvesAdded} improvements queued (no urgent fixes)`,
        description: (clusters.length > 0
          ? tikTokActive
            ? 'Prompts generated but execution paused during TikTok review.'
            : 'Click Accept to launch auto-fix. PR will be ready in ~5-10 min.'
          : 'No urgent fixes tonight. Improvements accumulating for Wednesday batch.') + tikTokWarning,
        color: clusters.length > 0 ? 0x5865F2 : 0x57F287,
        fields,
        footer: { text: 'Viral Animal Audit System' },
        timestamp: new Date().toISOString(),
      }],
      components: components.length > 0 ? components : undefined,
    })
  } catch (err) {
    console.warn('[auto-prompt] Discord notification failed:', err)
  }
}

// Allow standalone execution
if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  runAutoPromptGenerator()
    .then((result) => { console.log('[auto-prompt] Done.', result); process.exit(0) })
    .catch((err) => { console.error('[auto-prompt] Fatal:', err); process.exit(1) })
}
