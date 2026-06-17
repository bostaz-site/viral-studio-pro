/**
 * Auto-Prompt Generator
 *
 * Reads all open critical+high findings from the last 24h,
 * clusters them by root cause via Claude,
 * generates a ready-to-launch Claude Code prompt per cluster,
 * saves to claude-code-prompts/auto/<date>/PROMPT-N.md,
 * commits and pushes to GitHub,
 * sends Discord notification with prompt count.
 *
 * Run: npx tsx scripts/audits/auto-prompt-generator.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface Cluster {
  name: string
  root_cause: string
  findings_addressed: number[]
  estimated_hours: number
  priority: number
  prompt_markdown: string
}

export async function runAutoPromptGenerator() {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fetch critical + high open findings from last 24h
  const { data: findings } = await admin
    .from('audit_findings')
    .select('*')
    .gte('created_at', since)
    .in('severity', ['critical', 'high'])
    .eq('status', 'open')
    .order('severity', { ascending: true })
    .limit(30)

  if (!findings || findings.length === 0) {
    console.log('[auto-prompt] No critical/high findings in last 24h, skipping')
    return
  }

  console.log(`[auto-prompt] Found ${findings.length} critical/high findings to cluster`)

  // Ask Claude to cluster + generate prompts
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    messages: [{
      role: 'user',
      content: `You are a senior engineering manager at a fast-moving SaaS startup.

Here are ${findings.length} audit findings from last night's automated review of viralanimal.com (a video editing SaaS for creators):

${findings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.agent_type} | ${f.title}
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

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[auto-prompt] Failed to parse Claude response')
    return
  }

  let clusters: Cluster[]
  try {
    const parsed = JSON.parse(jsonMatch[0])
    clusters = parsed.clusters ?? []
  } catch (err) {
    console.error('[auto-prompt] JSON parse error:', err)
    return
  }

  if (clusters.length === 0) {
    console.log('[auto-prompt] Claude returned 0 clusters')
    return
  }

  // Write each cluster to claude-code-prompts/auto/<date>/
  const dateStr = new Date().toISOString().slice(0, 10)
  const promptsDir = join(process.cwd(), 'claude-code-prompts', 'auto', dateStr)
  mkdirSync(promptsDir, { recursive: true })

  const promptFiles: string[] = []
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
    promptFiles.push(filename)
    console.log(`[auto-prompt] Wrote ${filename} (priority ${cluster.priority}, est. ${cluster.estimated_hours}h, ${cluster.findings_addressed.length} findings)`)
  }

  // Commit + push to GitHub
  try {
    const relDir = `claude-code-prompts/auto/${dateStr}/`
    execSync(`git add "${relDir}"`, { cwd: process.cwd(), stdio: 'pipe' })
    execSync(
      `git -c user.email="audit@viralanimal.com" -c user.name="Night Audit Agent" commit -m "auto: ${clusters.length} fix prompts generated from ${dateStr} audit"`,
      { cwd: process.cwd(), stdio: 'pipe' },
    )

    // Use GITHUB_TOKEN if available for auth (Railway containers)
    const token = process.env.GITHUB_TOKEN
    if (token) {
      execSync(
        `git remote set-url origin https://x-access-token:${token}@github.com/bostaz-site/viral-studio-pro.git`,
        { cwd: process.cwd(), stdio: 'pipe' },
      )
    }

    execSync('git push origin master', { cwd: process.cwd(), stdio: 'pipe' })
    console.log(`[auto-prompt] Committed and pushed ${clusters.length} prompts`)
  } catch (err) {
    console.error('[auto-prompt] Git push failed:', err instanceof Error ? err.message : err)
  }

  // Discord notification
  await sendDiscordPromptsReady(clusters, dateStr)

  return clusters
}

async function sendDiscordPromptsReady(clusters: Cluster[], date: string) {
  const webhook = process.env.DISCORD_AUDIT_WEBHOOK_URL
  if (!webhook) return

  const repoUrl = 'https://github.com/bostaz-site/viral-studio-pro'

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${clusters.length} fix prompts ready to launch`,
          description: 'Auto-generated from tonight\'s audit. Launch in parallel for max speed.',
          color: 0x5865F2,
          fields: clusters.slice(0, 4).map((c, i) => {
            const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
            return {
              name: `P${c.priority}: ${c.name}`,
              value: `${c.root_cause}\n${c.findings_addressed.length} findings | ~${c.estimated_hours}h\n[View prompt](${repoUrl}/blob/master/claude-code-prompts/auto/${date}/PROMPT-${i + 1}-${slug}.md)`,
              inline: false,
            }
          }),
          footer: { text: 'Viral Animal Audit System' },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
    console.log('[auto-prompt] Discord notification sent')
  } catch (err) {
    console.warn('[auto-prompt] Discord notification failed:', err)
  }
}

// Allow standalone execution
if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  runAutoPromptGenerator()
    .then(() => { console.log('[auto-prompt] Done.'); process.exit(0) })
    .catch((err) => { console.error('[auto-prompt] Fatal:', err); process.exit(1) })
}
