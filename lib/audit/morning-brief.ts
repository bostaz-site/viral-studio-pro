import { createAdminClient } from '../supabase/admin'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterList = (activeClusters ?? []) as any[]

  const brief = `# Morning Brief - ${todayStr} (${dayNames[today.getDay()]})

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
        .map((f) => {
          const roi = f.roi_score ? ` | ROI: ${Number(f.roi_score).toFixed(0)}` : ''
          const effort = f.predicted_effort_hours ? ` | ${f.predicted_effort_hours}h` : ''
          const conf = f.predicted_confidence ? ` | conf ${f.predicted_confidence}/10` : ''
          return `- **${(f.severity as string).toUpperCase()}** | ${f.agent_type} | ${f.title}${roi}${effort}${conf}`
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

---
Open in dashboard: https://viralanimal.com/admin/audits
`

  // Save to Supabase Storage
  const filename = `morning-briefs/${todayStr}.md`
  await admin.storage.from('audit-screenshots').upload(filename, brief, {
    contentType: 'text/markdown',
    upsert: true,
  })

  // Optional email digest via Resend
  await sendEmailDigest(brief, todayStr)

  console.log(`[morning-brief] Generated for ${todayStr}`)
  return brief
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
