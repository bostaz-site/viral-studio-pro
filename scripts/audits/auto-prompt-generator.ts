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
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

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

  const classifyText = classifyResponse.content[0].type === 'text' ? classifyResponse.content[0].text : ''
  const classifyMatch = classifyText.match(/\{[\s\S]*\}/)
  let classifications: Classification[] = []
  try {
    const parsed = JSON.parse(classifyMatch?.[0] ?? '{}')
    classifications = parsed.classifications ?? []
  } catch {
    console.error('[auto-prompt] Classification parse failed, treating all as FIX')
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
      max_tokens: 16384,
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

    const clusterText = clusterResponse.content[0].type === 'text' ? clusterResponse.content[0].text : ''
    const clusterMatch = clusterText.match(/\{[\s\S]*\}/)
    try {
      const parsed = JSON.parse(clusterMatch?.[0] ?? '{}')
      clusters = parsed.clusters ?? []
    } catch (err) {
      console.error('[auto-prompt] Cluster parse error:', err)
    }
  }

  // ── Step 4: Write FIX prompts to disk ──
  const dateStr = new Date().toISOString().slice(0, 10)

  if (clusters.length > 0) {
    const promptsDir = join(process.cwd(), 'claude-code-prompts', 'auto', dateStr)
    mkdirSync(promptsDir, { recursive: true })

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      const slug = cluster.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
      const filename = `PROMPT-${i + 1}-${slug}.md`
      const filepath = join(promptsDir, filename)
      writeFileSync(filepath, cluster.prompt_markdown)
      console.log(`[auto-prompt] Wrote ${filename} (priority ${cluster.priority}, est. ${cluster.estimated_hours}h, ${cluster.findings_addressed.length} findings)`)
    }

    // Commit + push
    try {
      const relDir = `claude-code-prompts/auto/${dateStr}/`
      execSync(`git add "${relDir}"`, { cwd: process.cwd(), stdio: 'pipe' })
      execSync(
        `git -c user.email="audit@viralanimal.com" -c user.name="Night Audit Agent" commit -m "auto: ${clusters.length} fix prompts generated from ${dateStr} audit"`,
        { cwd: process.cwd(), stdio: 'pipe' },
      )

      const token = process.env.GITHUB_TOKEN
      if (token) {
        execSync(
          `git remote set-url origin https://x-access-token:${token}@github.com/bostaz-site/viral-studio-pro.git`,
          { cwd: process.cwd(), stdio: 'pipe' },
        )
      }

      execSync('git push origin master', { cwd: process.cwd(), stdio: 'pipe' })
      console.log(`[auto-prompt] Committed and pushed ${clusters.length} fix prompts`)
    } catch (err) {
      console.error('[auto-prompt] Git push failed:', err instanceof Error ? err.message : err)
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
  const webhook = process.env.DISCORD_AUDIT_WEBHOOK_URL
  if (!webhook) return

  const repoUrl = 'https://github.com/bostaz-site/viral-studio-pro'

  const fields: Array<{ name: string; value: string; inline: boolean }> = []

  // FIX clusters
  for (let i = 0; i < Math.min(clusters.length, 4); i++) {
    const c = clusters[i]
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    fields.push({
      name: `FIX P${c.priority}: ${c.name}`,
      value: `${c.root_cause}\n${c.findings_addressed.length} findings | ~${c.estimated_hours}h\n[View prompt](${repoUrl}/blob/master/claude-code-prompts/auto/${date}/PROMPT-${i + 1}-${slug}.md)`,
      inline: false,
    })
  }

  // IMPROVE summary
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

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: clusters.length > 0
            ? `${clusters.length} fix prompts ready + ${improvesAdded} improvements queued`
            : `${improvesAdded} improvements queued (no urgent fixes)`,
          description: clusters.length > 0
            ? 'Fix prompts ready to launch. Improvements batched for Wednesday.'
            : 'No urgent fixes tonight. Improvements accumulating for Wednesday batch.',
          color: clusters.length > 0 ? 0x5865F2 : 0x57F287,
          fields,
          footer: { text: 'Viral Animal Audit System' },
          timestamp: new Date().toISOString(),
        }],
      }),
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
