/**
 * Weekly Improvement Batcher — runs WEDNESDAYS
 *
 * Picks top 5 improvements from improvement_backlog by:
 *   score = predicted_impact_score - predicted_effort_score (descending)
 * where status = 'queued'.
 *
 * Generates a SINGLE consolidated Claude Code prompt that ships all 5 together.
 * Marks the 5 picked items as status='batched'.
 * Saves prompt to claude-code-prompts/auto/<date>/IMPROVE-BATCH.md
 * Discord notification.
 *
 * Run: npx tsx scripts/audits/weekly-improvement-batch.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface BacklogItem {
  id: string
  title: string
  description: string
  predicted_impact_score: number
  predicted_effort_score: number
  category: string
  finding_ids: string[]
}

export async function runWeeklyImprovementBatch() {
  const admin = createAdminClient()

  // Fetch all queued improvements, sorted by net score (impact - effort)
  const { data: queued } = await admin
    .from('improvement_backlog')
    .select('*')
    .eq('status', 'queued')
    .order('predicted_impact_score', { ascending: false })
    .limit(50)

  if (!queued || queued.length === 0) {
    console.log('[improve-batch] No queued improvements, skipping')
    return
  }

  // Sort by net value: impact - effort (descending)
  const sorted = [...queued].sort(
    (a, b) => (b.predicted_impact_score - b.predicted_effort_score)
            - (a.predicted_impact_score - a.predicted_effort_score)
  ) as BacklogItem[]

  const top5 = sorted.slice(0, 5)
  const remaining = queued.length - top5.length

  console.log(`[improve-batch] Picked top ${top5.length} from ${queued.length} queued improvements`)

  // Generate a single consolidated Claude Code prompt
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are a senior engineer shipping a weekly improvement batch for viralanimal.com (a video editing SaaS for creators).

Here are 5 improvements to ship together in ONE pull request:

${top5.map((item, i) => `${i + 1}. [Impact: ${item.predicted_impact_score}/10, Effort: ${item.predicted_effort_score}/10] ${item.title}
   Category: ${item.category}
   Description: ${item.description}`).join('\n\n')}

Generate a complete Claude Code prompt that implements ALL 5 improvements in a single session.
The prompt must be:
- Self-contained (Claude Code starts fresh — explain context)
- Specific with file paths where possible
- Include a "## Definition of Done" checklist (one item per improvement)
- Include "## Commit message" with format: "improve: weekly batch — <summary>"
- Group changes by file when possible to minimize PR size
- Start with "# " title

Output ONLY the markdown prompt content, no wrapping JSON.`,
    }],
  })

  const promptContent = response.content[0].type === 'text' ? response.content[0].text : ''

  if (!promptContent || promptContent.length < 100) {
    console.error('[improve-batch] Claude returned empty/short prompt')
    return
  }

  // Write the batch prompt
  const dateStr = new Date().toISOString().slice(0, 10)
  const promptsDir = join(process.cwd(), 'claude-code-prompts', 'auto', dateStr)
  mkdirSync(promptsDir, { recursive: true })

  const filename = 'IMPROVE-BATCH.md'
  const filepath = join(promptsDir, filename)
  writeFileSync(filepath, promptContent)
  console.log(`[improve-batch] Wrote ${filename}`)

  // Mark picked items as 'batched'
  const monday = getMondayOfWeek(new Date())
  for (const item of top5) {
    await admin
      .from('improvement_backlog')
      .update({ status: 'batched', batched_in_week_of: monday })
      .eq('id', item.id)
  }
  console.log(`[improve-batch] Marked ${top5.length} items as batched (week of ${monday})`)

  // Commit + push
  try {
    const relDir = `claude-code-prompts/auto/${dateStr}/`
    execSync(`git add "${relDir}"`, { cwd: process.cwd(), stdio: 'pipe' })
    execSync(
      `git -c user.email="audit@viralanimal.com" -c user.name="Night Audit Agent" commit -m "auto: weekly improvement batch ${dateStr} (${top5.length} items)"`,
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
    console.log('[improve-batch] Committed and pushed batch prompt')
  } catch (err) {
    console.error('[improve-batch] Git push failed:', err instanceof Error ? err.message : err)
  }

  // Discord notification
  await sendDiscordBatchReady(top5, remaining, dateStr)

  return { batched: top5.length, remaining }
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

async function sendDiscordBatchReady(items: BacklogItem[], remaining: number, date: string) {
  const webhook = process.env.DISCORD_AUDIT_WEBHOOK_URL
  if (!webhook) return

  const repoUrl = 'https://github.com/bostaz-site/viral-studio-pro'

  const table = items.map((item) =>
    `**${item.predicted_impact_score}** imp / **${item.predicted_effort_score}** eff — ${item.title}`
  ).join('\n')

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `IMPROVE BATCH — top ${items.length} for this week`,
          description: `${table}\n\n[View prompt](${repoUrl}/blob/master/claude-code-prompts/auto/${date}/IMPROVE-BATCH.md)\n\nShip all ${items.length} in one PR. Measure metrics next Monday.\n${remaining} more in backlog.`,
          color: 0x57F287,
          footer: { text: 'Viral Animal Audit System' },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
  } catch (err) {
    console.warn('[improve-batch] Discord notification failed:', err)
  }
}

// Allow standalone execution
if (require.main === module) {
  const { config } = require('dotenv')
  config({ path: '.env.local' })

  runWeeklyImprovementBatch()
    .then((result) => { console.log('[improve-batch] Done.', result); process.exit(0) })
    .catch((err) => { console.error('[improve-batch] Fatal:', err); process.exit(1) })
}
