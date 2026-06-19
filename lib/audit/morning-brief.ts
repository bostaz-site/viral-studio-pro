import { createAdminClient } from '../supabase/admin'
import { isPreLaunchMode } from './pre-launch-mode'

export async function generateMorningBrief(): Promise<string> {
  const admin = createAdminClient()
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const isoYesterday = yesterday.toISOString()

  // New findings since yesterday — sorted by ROI score (highest first)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newFindings } = await (admin as any)
    .from('audit_findings')
    .select('*')
    .gte('created_at', isoYesterday)
    .eq('status', 'open')
    .order('roi_score', { ascending: false, nullsFirst: false })

  // Split findings by severity into FIX vs IMPROVE
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const allFindings: any[] = newFindings ?? []
  const fixFindings = allFindings.filter(
    (f: any) => f.severity === 'critical' || f.severity === 'high'
  )
  const improveFindings = allFindings.filter(
    (f: any) => f.severity === 'normal' || f.severity === 'low'
  )
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Recurring (cycle_count >= 2)
  const { data: recurring } = await admin
    .from('audit_findings')
    .select('*')
    .gte('cycle_count', 2)
    .eq('status', 'open')
    .order('cycle_count', { ascending: false })

  // Fixed since yesterday
  const { data: fixed } = await admin
    .from('audit_findings')
    .select('*')
    .gte('updated_at', isoYesterday)
    .eq('status', 'fixed')

  // Regressions detected
  const { data: regressions } = await admin
    .from('audit_findings')
    .select('*')
    .ilike('title', 'Regression:%')
    .eq('status', 'open')
    .gte('created_at', isoYesterday)

  // Root cause clusters (identified = actionable)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeClusters } = await (admin as any)
    .from('root_cause_clusters')
    .select('cluster_name, findings_count, estimated_impact, estimated_effort_hours, confidence_score, status')
    .in('status', ['identified', 'in_progress'])
    .order('findings_count', { ascending: false })
    .limit(5)

  // Production errors (last 24h, status = 'new')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prodErrors } = await (admin as any)
    .from('production_errors')
    .select('error_type, error_message, occurrence_count, affected_users_count, affected_file, ai_root_cause, root_cause_cluster_id, status')
    .eq('status', 'new')
    .gte('last_seen_at', isoYesterday)
    .order('occurrence_count', { ascending: false })
    .limit(10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prodErrorsList = (prodErrors ?? []) as any[]

  // Count orphan findings (open, no cluster)
  const { count: orphanCount } = await admin
    .from('audit_findings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .is('root_cause_cluster_id', null)

  // Improvement backlog stats
  const { count: backlogQueued } = await admin
    .from('improvement_backlog')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  const { data: topBacklog } = await admin
    .from('improvement_backlog')
    .select('title, predicted_impact_score, predicted_effort_score')
    .eq('status', 'queued')
    .order('predicted_impact_score', { ascending: false })
    .limit(3)

  // Recent PR reviews (last 7 days)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentPRReviews } = await (admin as any)
    .from('pr_reviews')
    .select('pr_number, pr_title, overall_grade, issues_found, patterns_detected, security_concerns, perf_concerns, review_summary')
    .gte('reviewed_at', sevenDaysAgo)
    .order('merged_at', { ascending: false })
    .limit(10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prReviews = (recentPRReviews ?? []) as any[]

  // KPI evolution (today vs 5 days ago)
  const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  const { data: kpisToday } = await admin
    .from('audit_metrics_snapshots')
    .select('metric_name, metric_value')
    .eq('snapshot_date', todayStr)

  const { data: kpisPast } = await admin
    .from('audit_metrics_snapshots')
    .select('metric_name, metric_value')
    .eq('snapshot_date', fiveDaysAgo)

  const kpiChanges = (kpisToday ?? []).map((t) => {
    const past = (kpisPast ?? []).find((p) => p.metric_name === t.metric_name)
    const change =
      past && past.metric_value
        ? ((t.metric_value - past.metric_value) / past.metric_value) * 100
        : null
    return { name: t.metric_name, today: t.metric_value, change }
  })

  const dayNames = [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ]

  const isWednesday = today.getDay() === 3

  // Session replays (weekly, only show on Wed/Thu)
  let sessionReplaySection = ''
  if (today.getDay() === 3 || today.getDay() === 4) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentReplays } = await (admin as any)
      .from('user_session_replays')
      .select('session_outcome, friction_points, abandoned_at_event, total_events')
      .gte('replayed_at', new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replays = (recentReplays ?? []) as any[]
    if (replays.length > 0) {
      const abandonedCount = replays.filter((r: { session_outcome: string }) => r.session_outcome === 'abandoned_at_step').length
      const convertedCount = replays.filter((r: { session_outcome: string }) => r.session_outcome === 'converted').length

      // Count friction by event
      const frictionMap = new Map<string, number>()
      for (const r of replays) {
        for (const fp of r.friction_points ?? []) {
          frictionMap.set(fp.event, (frictionMap.get(fp.event) ?? 0) + 1)
        }
      }
      const topFriction = [...frictionMap.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)

      sessionReplaySection = `\n## USER SESSIONS REPLAYED (weekly)

${replays.length} real sessions replayed | ${abandonedCount} abandoned | ${convertedCount} converted
${topFriction.length > 0
  ? topFriction.map(([event, count]) => `- Friction: ${event} (${count} sessions)`).join('\n')
  : '- No significant friction detected'}
`
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterList = (activeClusters ?? []) as any[]

  const preLaunchBanner = isPreLaunchMode()
    ? `**PRE-LAUNCH MODE** — Traffic-dependent findings skipped. Set PRE_LAUNCH_MODE=false after first 100 signups.\n\n`
    : ''

  const brief = `# Morning Brief - ${todayStr} (${dayNames[today.getDay()]})

${preLaunchBanner}## PRODUCTION ERRORS (last 24h — ${prodErrorsList.length} new)
${
  prodErrorsList.length === 0
    ? '- All clear, no new production errors'
    : prodErrorsList
        .slice(0, 5)
        .map((e: { occurrence_count: number; affected_users_count: number | null; error_type: string; error_message: string; ai_root_cause: string | null; affected_file: string | null; root_cause_cluster_id: string | null }) => {
          const sevLabel = e.occurrence_count >= 100 ? 'CRITICAL' : e.occurrence_count >= 20 ? 'HIGH' : 'NORMAL'
          const sevIcon = e.occurrence_count >= 100 ? '🔴' : e.occurrence_count >= 20 ? '🟧' : '🟡'
          const users = e.affected_users_count ? ` (affects ${e.affected_users_count} users)` : ''
          const cause = e.ai_root_cause ? `\n  → Likely cause: ${e.ai_root_cause}` : ''
          const cluster = e.root_cause_cluster_id ? `\n  → Linked to cluster` : ''
          return `${sevIcon} ${sevLabel} — ${e.error_type}: ${e.error_message.slice(0, 80)} — ${e.occurrence_count.toLocaleString()} occurrences${users}${cause}${cluster}`
        })
        .join('\n\n')
}

## ROOT CAUSES (${clusterList.length} — fix these first)
${
  clusterList.length === 0
    ? '- No active root cause clusters'
    : clusterList
        .map(
          (c: { cluster_name: string; findings_count: number; estimated_impact: number; estimated_effort_hours: number; confidence_score: number; status: string }, i: number) =>
            `### #${i + 1} ${c.cluster_name}
Impact: ${c.estimated_impact}/10 | Effort: ~${c.estimated_effort_hours}h | Confidence: ${c.confidence_score}/10 | **Fixes ${c.findings_count} findings**${c.status === 'in_progress' ? ' (in progress)' : ''}`
        )
        .join('\n\n')
}
${orphanCount ? `\n_${orphanCount} orphan findings not in any cluster_` : ''}

## FIX (today — ${fixFindings.length} urgent, sorted by ROI)
${
  fixFindings.length === 0
    ? '- All clear, no urgent fixes'
    : fixFindings
        .slice(0, 5)
        .map((f: any) => {
          const bucket = f.predicted_impact_bucket ? ` | ${f.predicted_impact_bucket.toUpperCase()}` : ''
          const effort = f.predicted_effort_hours ? ` | ${f.predicted_effort_hours}h` : ''
          const conf = f.predicted_confidence ? ` | conf ${f.predicted_confidence}/10` : ''
          return `- **${(f.severity as string).toUpperCase()}** | ${f.agent_type} | ${f.title}${bucket}${effort}${conf}`
        })
        .join('\n')
}

## IMPROVE
- ${improveFindings.length} new improvements added to backlog today
${
  (topBacklog ?? []).length > 0
    ? `- Top 3 in backlog:\n${(topBacklog ?? [])
        .map(
          (b) =>
            `  - [${b.predicted_impact_score}imp/${b.predicted_effort_score}eff] ${b.title}`
        )
        .join('\n')}`
    : '- Backlog empty'
}
- ${backlogQueued ?? 0} total queued${isWednesday ? ' — **batch shipping tonight**' : ' — next batch ships Wednesday'}

## ADD
- Feature suggestions skipped (see Monday Strategic Brief)

## Recurring findings (${recurring?.length ?? 0})
${
  (recurring ?? []).length === 0
    ? '- None'
    : (recurring ?? [])
        .slice(0, 3)
        .map((f) => `- (${f.cycle_count}x cycles) ${f.title}`)
        .join('\n')
}

## Regressions detected (${regressions?.length ?? 0})
${
  (regressions ?? []).length === 0
    ? '- None'
    : (regressions ?? [])
        .map((f) => `- ${f.title}`)
        .join('\n')
}

## Verified fixed since yesterday (${fixed?.length ?? 0})
${
  (fixed ?? []).length === 0
    ? '- None'
    : (fixed ?? [])
        .slice(0, 5)
        .map((f) => `- ${f.title}`)
        .join('\n')
}

## KPIs evolution
${
  kpiChanges.length === 0
    ? '- No metrics recorded yet'
    : kpiChanges
        .map((k) => {
          const arrow =
            k.change !== null
              ? `${k.change > 0 ? '+' : ''}${k.change.toFixed(1)}%`
              : 'no history'
          return `- ${k.name}: ${k.today} (${arrow})`
        })
        .join('\n')
}
${sessionReplaySection}

## RECENT PR REVIEWS (last 7d — ${prReviews.length} reviewed)
${
  prReviews.length === 0
    ? '- No PR reviews yet'
    : (() => {
        const gradeMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
        const avg = prReviews.reduce((s: number, r: { overall_grade: string }) => s + (gradeMap[r.overall_grade] ?? 2), 0) / prReviews.length
        const avgLetter = avg >= 3.5 ? 'A' : avg >= 2.5 ? 'B' : avg >= 1.5 ? 'C' : avg >= 0.5 ? 'D' : 'F'
        const lines = [`Average grade: ${avgLetter} (${avg.toFixed(1)}/4.0)\n`]
        for (const r of prReviews.slice(0, 5)) {
          const icon = r.overall_grade === 'A' ? '🟢' : r.overall_grade === 'B' ? '🔵' : r.overall_grade === 'C' ? '🟡' : r.overall_grade === 'D' ? '🟧' : '🔴'
          const issueCount = (r.issues_found?.length ?? 0) + (r.security_concerns?.length ?? 0) + (r.perf_concerns?.length ?? 0)
          const patternCount = r.patterns_detected?.length ?? 0
          let detail = ''
          if (issueCount > 0) detail += `${issueCount} issues`
          if (patternCount > 0) detail += `${detail ? ', ' : ''}${patternCount} patterns`
          if (!detail) detail = 'Clean'
          lines.push(`${icon} PR #${r.pr_number} — ${r.pr_title} (grade: ${r.overall_grade})\n  ${detail}`)
        }
        return lines.join('\n')
      })()
}

`

  // Mandatory anti-suggestion section
  const antiSuggestion = generateAntiSuggestion(fixFindings, clusterList)
  const briefWithAnti = brief + `\n## Anti-suggestion\n${antiSuggestion}\n\n---\nOpen in dashboard: https://viralanimal.com/admin/audits\n`

  // Enforce 3-min reading cap (600 words max)
  const finalBrief = enforceWordCap(briefWithAnti)

  // Save to Supabase Storage
  const filename = `morning-briefs/${todayStr}.md`
  await admin.storage.from('audit-screenshots').upload(filename, finalBrief, {
    contentType: 'text/markdown',
    upsert: true,
  })

  // Optional email digest via Resend
  await sendEmailDigest(finalBrief, todayStr)

  console.log(`[morning-brief] Generated for ${todayStr} (${finalBrief.split(/\s+/).length} words)`)
  return finalBrief
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateAntiSuggestion(fixFindings: any[], clusters: any[]): string {
  // If there are many low-severity findings but few high ones, warn against fixing cosmetic stuff
  const lowCount = fixFindings.filter((f: any) => f.severity === 'low' || f.severity === 'normal').length
  const criticalCount = fixFindings.filter((f: any) => f.severity === 'critical').length

  if (criticalCount > 0 && clusters.length > 0) {
    return `Don't fix isolated findings today. Focus on the ${clusters.length} root cause clusters above — they fix ${clusters.reduce((s: number, c: any) => s + (c.findings_count ?? 0), 0)} findings at once.`
  }
  if (lowCount > 3 && criticalCount === 0) {
    return `Don't chase the ${lowCount} low-priority items. No critical issues today — use this time to ship a strategic move instead.`
  }
  return 'No anti-suggestion this week. Focus on shipping the top 3 clusters.'
}

const MAX_BRIEF_WORDS = 600

function enforceWordCap(brief: string): string {
  const wordCount = brief.split(/\s+/).length
  if (wordCount <= MAX_BRIEF_WORDS) return brief

  const sections = brief.split('\n## ')
  let result = sections[0]
  let currentWordCount = result.split(/\s+/).length

  for (let i = 1; i < sections.length; i++) {
    const section = '\n## ' + sections[i]
    const sectionWordCount = section.split(/\s+/).length

    if (currentWordCount + sectionWordCount > MAX_BRIEF_WORDS) {
      result += `\n## More details\nTruncated at ${MAX_BRIEF_WORDS} words (3-min cap). Full report: https://viralanimal.com/admin/audits\n`
      break
    }

    result += section
    currentWordCount += sectionWordCount
  }

  return result
}

async function sendEmailDigest(content: string, dateStr: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[morning-brief] RESEND_API_KEY not set, skipping email')
    return
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'audits@viralanimal.com',
        to: ['samycloutier30@gmail.com'],
        subject: `Audit brief ${dateStr}`,
        text: content,
      }),
    })
    console.log('[morning-brief] Email sent')
  } catch (err) {
    console.error('[morning-brief] Email failed:', err)
  }
}
