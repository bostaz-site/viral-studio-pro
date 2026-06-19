import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushFileToGitHub } from '@/lib/audit/github-push'
import { sendBotMessage } from '@/lib/audit/discord'

export const GET = withAdmin(async (req: NextRequest) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const status = req.nextUrl.searchParams.get('status') || 'completed'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 50)

  // Fetch dives
  let query = admin
    .from('lab_deep_dives')
    .select('id, feature_area, cycle_number, status, confidence, estimated_effort_hours, kill_switch_severity, kill_switch_scenario, target_metric, metric_clarity_score, final_recommendation, total_cost_usd, total_duration_seconds, user_action, created_at, deliverable_completed_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') query = query.eq('status', status)

  const { data: dives, error } = await query
  if (error) return errorResponse(error.message, 500)

  // Fetch queue
  const { data: queue } = await admin
    .from('lab_queue')
    .select('*')
    .eq('active', true)
    .order('forced_next', { ascending: false })
    .order('priority', { ascending: false })
    .order('next_scheduled_at', { ascending: true })

  // Stats
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthDives } = await admin
    .from('lab_deep_dives')
    .select('total_cost_usd, confidence, status')
    .gte('created_at', startOfMonth.toISOString())

  const monthStats = {
    totalDives: (monthDives ?? []).length,
    completedDives: (monthDives ?? []).filter((d: { status: string }) => d.status === 'completed').length,
    totalCost: (monthDives ?? []).reduce((s: number, d: { total_cost_usd: number | null }) => s + (d.total_cost_usd ?? 0), 0),
    avgConfidence: (monthDives ?? []).filter((d: { confidence?: number }) => d.confidence).length > 0
      ? (monthDives ?? []).reduce((s: number, d: { confidence?: number }) => s + (d.confidence ?? 0), 0) /
        (monthDives ?? []).filter((d: { confidence?: number }) => d.confidence).length
      : 0,
  }

  return jsonResponse({ dives, queue, monthStats })
})

export const PATCH = withAdmin(async (req: NextRequest) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const body = await req.json()

  // Update dive action (accept/later/discard)
  if (body.diveId && body.action) {
    const validActions = ['accepted', 'later', 'discarded']
    if (!validActions.includes(body.action)) return errorResponse('Invalid action', 400)

    const updates: Record<string, unknown> = {
      user_action: body.action,
      user_action_at: new Date().toISOString(),
    }
    if (body.action === 'discarded') updates.status = 'discarded'

    await admin.from('lab_deep_dives').update(updates).eq('id', body.diveId)

    // On accept: generate prompt file, push to GitHub, ping Discord
    if (body.action === 'accepted') {
      try {
        const { data: dive } = await admin
          .from('lab_deep_dives')
          .select('feature_area, cycle_number, target_metric, target_delta_minimum, measurement_method, final_recommendation, recommendation_rationale, kill_switch_scenario, kill_switch_severity, alternatives_rejected, estimated_effort_hours, confidence')
          .eq('id', body.diveId)
          .single()

        if (dive) {
          const prompt = generateLabPrompt(dive)
          const slug = (dive.final_recommendation ?? 'fix')
            .slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          const filename = `${dive.feature_area}-cycle${dive.cycle_number}-${slug}.md`
          const filepath = `docs/lab/prompts/${filename}`

          let githubUrl = ''
          try {
            githubUrl = await pushFileToGitHub(filepath, prompt, `lab: accept ${dive.feature_area} cycle ${dive.cycle_number}`)
          } catch (err) {
            console.warn('[lab] GitHub push failed:', err)
          }

          await admin.from('lab_deep_dives').update({ accepted_prompt_path: filepath }).eq('id', body.diveId)

          // Discord notification
          const channelId = process.env.DISCORD_LAB_CHANNEL_ID || process.env.DISCORD_MORNING_BRIEF_CHANNEL_ID
          if (channelId) {
            await sendBotMessage(channelId, {
              embeds: [{
                title: `Lab: ${dive.feature_area} accepted`,
                description: `Prompt: \`${filepath}\`\n${githubUrl ? `[View on GitHub](${githubUrl})` : ''}\n\nRun:\n\`\`\`\nclaude "Lis ${filepath} et implemente"\n\`\`\``,
                color: 0x57F287,
              }],
            }).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[lab] Accept prompt generation failed:', err)
      }
    }

    return jsonResponse({ updated: true })
  }

  // Force-queue a feature
  if (body.forceArea) {
    await admin
      .from('lab_queue')
      .update({ forced_next: true, next_scheduled_at: new Date().toISOString() })
      .eq('feature_area', body.forceArea)
    return jsonResponse({ forced: true })
  }

  return errorResponse('Invalid request', 400)
})

export const POST = withAdmin(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Check no cycle already in progress
  const { data: running } = await admin
    .from('lab_deep_dives')
    .select('id, feature_area')
    .eq('status', 'running')
    .limit(1)

  if (running && running.length > 0) {
    return errorResponse(`Cycle already in progress (${running[0].feature_area})`, 409)
  }

  // Check if Railway trigger URL is configured
  const triggerUrl = process.env.RAILWAY_LAB_TRIGGER_URL
  if (triggerUrl) {
    // Trigger Railway job
    await fetch(`${triggerUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.RAILWAY_LAB_API_KEY ?? '',
      },
      body: JSON.stringify({ command: 'lab:chain' }),
    }).catch(err => {
      console.error('[lab:api] Railway trigger failed:', err)
    })
    return jsonResponse({ started: true, via: 'railway' })
  }

  // No Railway — try local subprocess (works if Next.js runs on same machine with tsx)
  try {
    const { spawn } = await import('child_process')
    const child = spawn('npx', ['tsx', 'scripts/lab/run-deep-dive.ts', '--chain'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    return jsonResponse({ started: true, via: 'local', pid: child.pid })
  } catch {
    return jsonResponse({
      started: false,
      message: 'Run manually: npx tsx scripts/lab/run-deep-dive.ts --chain',
      via: 'manual',
    })
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateLabPrompt(dive: any): string {
  const alts = Array.isArray(dive.alternatives_rejected)
    ? dive.alternatives_rejected.map((a: { alt: string; why_rejected: string }) => `- ${a.alt}: ${a.why_rejected}`).join('\n')
    : '- None recorded'

  const ccEffort = Math.max(0.25, Math.round((dive.estimated_effort_hours ?? 2) / 5 * 10) / 10)

  return `# Lab Prompt — ${dive.feature_area} (cycle #${dive.cycle_number})

> Auto-generated from Lab deep dive on ${new Date().toISOString().slice(0, 10)}

## Target Metric
**${dive.target_metric ?? 'N/A'}** — minimum delta: ${dive.target_delta_minimum ?? 'N/A'}

Measurement: ${dive.measurement_method ?? 'N/A'}

## Final Recommendation
${dive.final_recommendation ?? 'N/A'}

## Rationale
${dive.recommendation_rationale ?? 'N/A'}

## Kill Switch — MUST ADDRESS (severity ${dive.kill_switch_severity ?? '?'}/10)
${dive.kill_switch_scenario ?? 'None identified'}

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
${alts}

## Effort
~${ccEffort}h with Claude Code (${dive.estimated_effort_hours ?? '?'}h human estimate)

## Confidence: ${dive.confidence ?? '?'}/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (\`npm run build\`)
- [ ] Commit: \`feat(${dive.feature_area}): lab cycle ${dive.cycle_number}\`
- [ ] Push to origin
`
}
