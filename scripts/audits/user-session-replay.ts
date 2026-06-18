/**
 * User Session Replay — runs WEEKLY (Wednesday)
 *
 * Replays real user sessions from analytics_events, analyzes friction
 * via Claude, compares with persona findings, and generates actionable insights.
 *
 * Privacy: all session_ids are hashed, no user_id/email/IP stored.
 *
 * Run: npx tsx scripts/audits/user-session-replay.ts
 */

import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../../lib/supabase/admin'
import { insertFinding } from '../../lib/audit/insert-finding'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MIN_EVENTS_PER_SESSION = 4
const MIN_TOTAL_EVENTS = 15
const MAX_SESSIONS_TO_ANALYZE = 8
const MAX_SESSIONS_PER_CLUSTER = 3

interface AnalyticsEvent {
  event_name: string
  page_path: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface SessionGroup {
  session_id: string
  events: AnalyticsEvent[]
  duration_seconds: number
  outcome: 'converted' | 'signed_up_no_action' | 'abandoned_at_step' | 'bounced'
  abandoned_at_event?: string
}

interface FrictionPoint {
  event: string
  type: 'confusion' | 'slowness' | 'broken'
  evidence: string
}

interface ClaudeSessionAnalysis {
  friction_points: FrictionPoint[]
  emotional_journey: string
  comparison_to_personas: Array<{ divergence: string; implication: string }>
  suggested_finding?: {
    title: string
    description: string
    severity: 'critical' | 'high' | 'normal' | 'low'
    location: string
    suggested_fix: string
  }
}

function hashSessionId(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

// Conversion signals: events that indicate the user "converted"
const CONVERSION_EVENTS = [
  'cta_signup_click',
  'exit_intent_submitted',
  'newsletter_submitted',
]

// High-intent events: user showed interest but may not have converted
const HIGH_INTENT_EVENTS = [
  'demo_cta_click',
  'cta_hero_click',
  'cta_pricing_click',
  'pricing_view',
  'demo_view',
]

function classifySession(events: AnalyticsEvent[]): {
  outcome: SessionGroup['outcome']
  abandoned_at_event?: string
} {
  const eventNames = events.map((e) => e.event_name)

  const hasConversion = eventNames.some((n) => CONVERSION_EVENTS.includes(n))
  if (hasConversion) return { outcome: 'converted' }

  const hasHighIntent = eventNames.some((n) => HIGH_INTENT_EVENTS.includes(n))
  if (hasHighIntent) {
    // Had intent but didn't convert
    const lastHighIntent = [...eventNames]
      .reverse()
      .find((n) => HIGH_INTENT_EVENTS.includes(n))
    return {
      outcome: 'abandoned_at_step',
      abandoned_at_event: lastHighIntent,
    }
  }

  if (events.length <= 2) return { outcome: 'bounced' }

  return { outcome: 'signed_up_no_action' }
}

function clusterSessions(
  sessions: SessionGroup[]
): Map<string, SessionGroup[]> {
  const clusters = new Map<string, SessionGroup[]>()

  for (const s of sessions) {
    // Cluster key: outcome + first 3 unique event types
    const uniqueEvents = [...new Set(s.events.map((e) => e.event_name))]
    const key = `${s.outcome}|${uniqueEvents.slice(0, 3).join(',')}`
    const existing = clusters.get(key) ?? []
    existing.push(s)
    clusters.set(key, existing)
  }

  return clusters
}

async function analyzeSession(
  session: SessionGroup
): Promise<ClaudeSessionAnalysis> {
  const eventsDesc = session.events
    .map((e, i) => {
      const ts = new Date(e.created_at)
      const relSec = Math.round(
        (ts.getTime() - new Date(session.events[0].created_at).getTime()) / 1000
      )
      const meta = e.metadata ? ` (${JSON.stringify(e.metadata)})` : ''
      return `  ${i + 1}. [+${relSec}s] ${e.event_name} @ ${e.page_path ?? '/'}${meta}`
    })
    .join('\n')

  const systemPrompt = `You are a UX analyst reviewing real user sessions on Viral Animal, a video editing SaaS for creators.

You receive an ordered sequence of analytics events from a real user session.

Output ONLY valid JSON:
{
  "friction_points": [
    {"event": "event_name", "type": "confusion"|"slowness"|"broken", "evidence": "why this is friction"}
  ],
  "emotional_journey": "narrative of user emotions through the session (1-2 sentences)",
  "comparison_to_personas": [
    {"divergence": "what real user did differently", "implication": "what this means for product"}
  ],
  "suggested_finding": {
    "title": "Short actionable title (max 100 chars)",
    "description": "What's wrong and why it matters (max 300 chars)",
    "severity": "critical"|"high"|"normal"|"low",
    "location": "surface or page path",
    "suggested_fix": "Concrete fix (max 200 chars)"
  }
}

Rules:
- If no real friction exists, return empty friction_points
- suggested_finding is optional — only include if there's a clear actionable issue
- Focus on patterns: repeated clicks, rapid page switches, abandoned flows
- "confusion" = user seems lost, "slowness" = user waits too long, "broken" = something didn't work`

  const userPrompt = `Session: ${session.session_id} (hashed)
Outcome: ${session.outcome}${session.abandoned_at_event ? ` (abandoned at: ${session.abandoned_at_event})` : ''}
Duration: ${session.duration_seconds}s
Total events: ${session.events.length}

Events timeline:
${eventsDesc}`

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      friction_points: [],
      emotional_journey: 'Unable to analyze',
      comparison_to_personas: [],
    }
  }

  return JSON.parse(jsonMatch[0])
}

export async function runSessionReplay() {
  const admin = createAdminClient()
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  console.log('[session-replay] Fetching analytics events from last 7 days...')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (admin as any)
    .from('analytics_events')
    .select('session_id, event_name, page_path, metadata, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) {
    console.error('[session-replay] Failed to fetch events:', error.message)
    return
  }

  const allEvents = (events ?? []) as (AnalyticsEvent & {
    session_id: string
  })[]

  if (allEvents.length < MIN_TOTAL_EVENTS) {
    console.log(
      `[session-replay] Not enough data (${allEvents.length} events, need ${MIN_TOTAL_EVENTS}). Skipping.`
    )
    return
  }

  // Group by session
  const sessionMap = new Map<string, AnalyticsEvent[]>()
  for (const ev of allEvents) {
    const existing = sessionMap.get(ev.session_id) ?? []
    existing.push({
      event_name: ev.event_name,
      page_path: ev.page_path,
      metadata: ev.metadata,
      created_at: ev.created_at,
    })
    sessionMap.set(ev.session_id, existing)
  }

  // Filter sessions with enough events
  const sessions: SessionGroup[] = []
  for (const [sessionId, evts] of sessionMap) {
    if (evts.length < MIN_EVENTS_PER_SESSION) continue

    const first = new Date(evts[0].created_at).getTime()
    const last = new Date(evts[evts.length - 1].created_at).getTime()
    const durationSec = Math.round((last - first) / 1000)

    const { outcome, abandoned_at_event } = classifySession(evts)

    sessions.push({
      session_id: hashSessionId(sessionId),
      events: evts,
      duration_seconds: durationSec,
      outcome,
      abandoned_at_event,
    })
  }

  console.log(
    `[session-replay] ${sessions.length} sessions with ${MIN_EVENTS_PER_SESSION}+ events`
  )

  if (sessions.length === 0) {
    console.log('[session-replay] No qualifying sessions. Skipping.')
    return
  }

  // Prioritize abandoned sessions (almost-converters)
  const prioritized = sessions.sort((a, b) => {
    const priority: Record<string, number> = {
      abandoned_at_step: 0,
      signed_up_no_action: 1,
      converted: 2,
      bounced: 3,
    }
    return (priority[a.outcome] ?? 3) - (priority[b.outcome] ?? 3)
  })

  // Cluster and pick representatives
  const clusters = clusterSessions(prioritized)
  const toAnalyze: SessionGroup[] = []

  for (const [, clusterSessions] of clusters) {
    const picked = clusterSessions.slice(0, MAX_SESSIONS_PER_CLUSTER)
    toAnalyze.push(...picked)
    if (toAnalyze.length >= MAX_SESSIONS_TO_ANALYZE) break
  }

  const finalBatch = toAnalyze.slice(0, MAX_SESSIONS_TO_ANALYZE)
  console.log(
    `[session-replay] Analyzing ${finalBatch.length} sessions across ${clusters.size} clusters...`
  )

  let replayed = 0
  let findingsCreated = 0
  const outcomeCounts = { converted: 0, abandoned: 0, bounced: 0, other: 0 }

  for (const session of finalBatch) {
    try {
      const analysis = await analyzeSession(session)

      // Build anonymized events sequence (strip exact timestamps)
      const eventsSequence = session.events.map((e, i) => {
        const relTs =
          i === 0
            ? 0
            : Math.round(
                (new Date(e.created_at).getTime() -
                  new Date(session.events[0].created_at).getTime()) /
                  1000
              )
        return {
          event_name: e.event_name,
          relative_ts: relTs,
          page_path: e.page_path,
        }
      })

      // Insert finding if suggested
      const findingIds: string[] = []
      if (analysis.suggested_finding) {
        const fid = await insertFinding({
          agent_type: 'session_replay',
          severity: analysis.suggested_finding.severity,
          title: analysis.suggested_finding.title,
          description: analysis.suggested_finding.description,
          location: analysis.suggested_finding.location,
          suggested_fix: analysis.suggested_finding.suggested_fix,
        })
        if (fid) {
          findingIds.push(fid)
          findingsCreated++
        }
      }

      // Insert replay record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('user_session_replays').insert({
        original_session_id: session.session_id,
        session_outcome: session.outcome,
        abandoned_at_event: session.abandoned_at_event ?? null,
        total_events: session.events.length,
        session_duration_seconds: session.duration_seconds,
        events_sequence: eventsSequence,
        friction_points: analysis.friction_points,
        emotional_journey: analysis.emotional_journey,
        comparison_to_personas: analysis.comparison_to_personas,
        finding_ids: findingIds,
      })

      replayed++

      if (session.outcome === 'converted') outcomeCounts.converted++
      else if (session.outcome === 'abandoned_at_step') outcomeCounts.abandoned++
      else if (session.outcome === 'bounced') outcomeCounts.bounced++
      else outcomeCounts.other++

      console.log(
        `[session-replay] Session ${session.session_id}: ${session.outcome} (${analysis.friction_points.length} friction points)`
      )
    } catch (err) {
      console.error(
        `[session-replay] Failed to analyze session ${session.session_id}:`,
        err
      )
    }
  }

  // Cross-reference with persona findings
  await crossReferencePersonas(admin, finalBatch)

  console.log(
    `[session-replay] Done: ${replayed} replayed, ${findingsCreated} findings created`
  )
  console.log(
    `[session-replay] Outcomes: ${outcomeCounts.converted} converted, ${outcomeCounts.abandoned} abandoned, ${outcomeCounts.bounced} bounced, ${outcomeCounts.other} other`
  )
}

async function crossReferencePersonas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  analyzedSessions: SessionGroup[]
) {
  // Get recent persona findings
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: personaFindings } = await admin
    .from('audit_findings')
    .select('title, description, location, persona')
    .in('persona', ['sceptical', 'free_limit', 'power'])
    .gte('created_at', sevenDaysAgo)
    .limit(20)

  if (!personaFindings || personaFindings.length === 0) return

  // Get all friction points from replayed sessions
  const realFrictionLocations = analyzedSessions
    .flatMap((s) => {
      const analysis = s as SessionGroup & { _analysis?: ClaudeSessionAnalysis }
      return analysis._analysis?.friction_points?.map((f) => f.event) ?? []
    })

  // Ask Claude to compare
  const personaSummary = (personaFindings as Array<{ title: string; location: string | null; persona: string }>)
    .map(
      (f) =>
        `- [${f.persona}] ${f.title} (location: ${f.location ?? 'unknown'})`
    )
    .join('\n')

  const sessionSummary = analyzedSessions
    .map(
      (s) =>
        `- Session ${s.session_id}: ${s.outcome}, ${s.events.length} events, ${s.duration_seconds}s`
    )
    .join('\n')

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Compare persona-generated findings with real user session data. Output JSON:
{
  "persona_blind_spots": ["friction that real users hit but personas missed"],
  "false_positives": ["persona findings that don't match real user behavior"],
  "calibration_notes": "1-2 sentence summary"
}`,
      messages: [
        {
          role: 'user',
          content: `Persona findings (last 7 days):\n${personaSummary}\n\nReal sessions analyzed:\n${sessionSummary}\n\nReal friction locations: ${realFrictionLocations.join(', ') || 'none detected'}`,
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const calibration = JSON.parse(jsonMatch[0])

    // Store calibration in agent_prompt_proposals if meaningful
    if (
      calibration.persona_blind_spots?.length > 0 ||
      calibration.false_positives?.length > 0
    ) {
      await admin.from('agent_prompt_proposals').insert({
        agent_name: 'session_replay_calibration',
        previous_prompt: personaSummary.slice(0, 500),
        proposed_prompt: calibration.calibration_notes ?? '',
        rationale: JSON.stringify({
          blind_spots: calibration.persona_blind_spots,
          false_positives: calibration.false_positives,
        }),
        status: 'proposed',
      })

      console.log(
        `[session-replay] Calibration: ${calibration.persona_blind_spots?.length ?? 0} blind spots, ${calibration.false_positives?.length ?? 0} false positives`
      )
    }
  } catch (err) {
    console.error('[session-replay] Cross-reference failed (non-blocking):', err)
  }
}

// Direct execution
if (require.main === module) {
  import('dotenv').then((d) => d.config({ path: '.env.local' }))
  runSessionReplay()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[session-replay] Fatal:', err)
      process.exit(1)
    })
}
