import { createAdminClient } from '../supabase/admin'

export async function generateStrategicBrief(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Current week's Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const thisWeekOf = monday.toISOString().slice(0, 10)

  // Last week's Monday
  const lastMonday = new Date(monday)
  lastMonday.setDate(monday.getDate() - 7)
  const lastWeekOf = lastMonday.toISOString().slice(0, 10)

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

  // 1. Last week's shipped moves
  const { data: lastWeekMoves } = await admin
    .from('strategic_moves')
    .select('*')
    .eq('proposed_week_of', lastWeekOf)
    .neq('status', 'parked')
    .order('impact', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipped = (lastWeekMoves ?? []).filter((m: any) => m.status === 'shipped')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notShipped = (lastWeekMoves ?? []).filter((m: any) => m.status !== 'shipped')
  const totalLastWeek = (lastWeekMoves ?? []).length
  const shippedPct = totalLastWeek > 0 ? Math.round((shipped.length / totalLastWeek) * 100) : 0

  // 2. This week's proposed moves (top — not parked)
  const { data: thisWeekMoves } = await admin
    .from('strategic_moves')
    .select('*')
    .eq('proposed_week_of', thisWeekOf)
    .eq('status', 'proposed')
    .order('impact', { ascending: false })
    .limit(9) // 3 per agent max

  // 3. Anti-suggestions (stored as parked moves with title starting with "ANTI:")
  // We'll extract from the move descriptions instead — the agents log them

  // 4. Backlog count
  const { count: backlogCount } = await admin
    .from('strategic_moves')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'parked')

  // 5. Group by agent type
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const allMoves: any[] = thisWeekMoves ?? []
  const aiScoutMoves = allMoves.filter((m: any) => m.agent_type === 'ai_scout')
  const revenueMoves = allMoves.filter((m: any) => m.agent_type === 'revenue')
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Build the brief
  const brief = `# Strategic Brief — ${dayNames[now.getDay()]} ${todayStr}

## Shipped Last Week
${totalLastWeek === 0
    ? '- No strategic moves were proposed last week'
    : `- ${shipped.length} of ${totalLastWeek} strategic moves shipped (${shippedPct}%)
${shipped.map((m: any) => `  - SHIPPED: "${m.title}" ${m.outcome_metric ? `-> ${m.outcome_metric}: ${m.outcome_value ?? 'pending'}` : '-> outcome pending'}`).join('\n')}
${notShipped.map((m: any) => `  - NOT SHIPPED: "${m.title}" (${m.status})`).join('\n')}`
}

## Top Moves This Week
${(thisWeekMoves ?? []).length === 0
    ? '- No moves proposed yet (strategic agents run Sunday night)'
    : (thisWeekMoves ?? []).slice(0, 9).map((m: any, i: number) => `
### Move #${i + 1} — ${m.title} (${m.agent_type})
**Impact: ${m.impact} | Effort: ${m.effort} | Confidence: ${m.confidence}**
**Evidence:** ${m.evidence}
**Category:** ${m.category}

${m.description}
`).join('')}

## AI Scout — New Capabilities
${aiScoutMoves.length === 0
    ? '- No AI capabilities flagged this cycle'
    : aiScoutMoves.map((m: any) => `- ${m.title}: ${m.evidence}`).join('\n')}

## Revenue Insights
${revenueMoves.length === 0
    ? '- No revenue moves this cycle'
    : revenueMoves.map((m: any) => `- ${m.title} (impact: ${m.impact}, confidence: ${m.confidence})`).join('\n')}

## Backlog
- ${backlogCount ?? 0} ideas parked in backlog
- View: https://viralanimal.com/admin/strategic-moves

---
Generated: ${now.toISOString()}
`

  // Save to Supabase Storage
  const filename = `strategic-briefs/${todayStr}.md`
  await admin.storage.from('audit-screenshots').upload(filename, brief, {
    contentType: 'text/markdown',
    upsert: true,
  })

  console.log(`[strategic-brief] Generated for ${todayStr}`)
  return brief
}
