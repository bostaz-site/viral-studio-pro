/**
 * Production Errors Agent — runs DAILY first in the nightly rotation
 *
 * MVP: Sentry API only. Netlify + Railway can come in V2.
 *
 * 1. Fetch issues from Sentry (last 24h)
 * 2. Normalize + dedupe by cluster_signature
 * 3. For clusters >= 5 occurrences: ask Claude for root cause + fix
 * 4. Insert as finding via insertFinding()
 * 5. Save raw errors to production_errors table
 * 6. Discord alert on critical spikes (>500 occurrences)
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { insertFinding } from '../../lib/audit/insert-finding'
import { sendDiscordAlert } from '../../lib/audit/discord'
import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN
const SENTRY_ORG = process.env.SENTRY_ORG || 'viral-animal'
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || 'viral-animal-web'
const MAX_ERRORS_PER_RUN = 50
const MIN_OCCURRENCES_FOR_FINDING = 5
const SPIKE_THRESHOLD = 500

interface SentryIssue {
  id: string
  title: string
  culprit: string
  shortId: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  level: string
  status: string
  type: string
  metadata: {
    type?: string
    value?: string
    filename?: string
    function?: string
  }
  permalink: string
}

interface NormalizedError {
  source: 'sentry'
  error_type: string
  error_message: string
  stack_trace: string | null
  affected_file: string | null
  affected_line: number | null
  occurrence_count: number
  affected_users_count: number
  first_seen_at: string
  last_seen_at: string
  cluster_signature: string
  sentry_issue_id: string
  sentry_url: string
}

/**
 * Normalize error message for dedup: strip UUIDs, IPs, timestamps, hex IDs
 */
function normalizeForSignature(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\dZ]*/g, '<TIMESTAMP>')
    .replace(/0x[0-9a-fA-F]+/g, '<HEX>')
    .replace(/\b[0-9a-f]{24,}\b/gi, '<ID>')
    .replace(/\d{10,}/g, '<NUM>')
    .trim()
}

function computeSignature(errorType: string, message: string, file: string | null): string {
  const normalized = normalizeForSignature(`${errorType}:${message}:${file || ''}`)
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

async function fetchSentryIssues(): Promise<SentryIssue[]> {
  if (!SENTRY_AUTH_TOKEN) {
    console.log('[prod-errors] SENTRY_AUTH_TOKEN not set, skipping Sentry fetch')
    return []
  }

  const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?statsPeriod=24h&query=is:unresolved&sort=freq&limit=${MAX_ERRORS_PER_RUN}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[prod-errors] Sentry API error ${res.status}: ${text}`)
    return []
  }

  return res.json()
}

function normalizeSentryIssues(issues: SentryIssue[]): NormalizedError[] {
  return issues.map((issue) => {
    const errorType = issue.metadata?.type || issue.type || 'UnknownError'
    const errorMessage = issue.title
    const affectedFile = issue.metadata?.filename || issue.culprit || null

    return {
      source: 'sentry' as const,
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: issue.culprit ? `${issue.culprit} (${issue.metadata?.function || 'unknown'})` : null,
      affected_file: affectedFile,
      affected_line: null,
      occurrence_count: parseInt(issue.count, 10) || 1,
      affected_users_count: issue.userCount || 0,
      first_seen_at: issue.firstSeen,
      last_seen_at: issue.lastSeen,
      cluster_signature: computeSignature(errorType, errorMessage, affectedFile),
      sentry_issue_id: issue.id,
      sentry_url: issue.permalink,
    }
  })
}

function classifySeverity(occurrences: number): 'critical' | 'high' | 'normal' {
  if (occurrences >= 100) return 'critical'
  if (occurrences >= 20) return 'high'
  return 'normal'
}

async function analyzeWithClaude(errors: NormalizedError[]): Promise<Array<{
  error: NormalizedError
  root_cause: string
  suggested_fix: string
}>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log('[prod-errors] ANTHROPIC_API_KEY not set, skipping AI analysis')
    return errors.map((e) => ({
      error: e,
      root_cause: 'AI analysis unavailable',
      suggested_fix: 'Check ANTHROPIC_API_KEY',
    }))
  }

  const client = new Anthropic({ apiKey })

  const errorSummaries = errors
    .slice(0, 15) // batch max 15 errors per Claude call
    .map((e, i) => `${i + 1}. [${e.occurrence_count}x, ${e.affected_users_count} users] ${e.error_type}: ${e.error_message}\n   File: ${e.affected_file || 'unknown'}\n   Stack: ${e.stack_trace || 'N/A'}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are analyzing production errors from a Next.js + Supabase web app (Viral Animal - clip editing platform).

For each error below, provide:
1. Likely root cause (1-2 sentences)
2. Suggested fix (1-2 sentences, actionable)

Respond in JSON array format:
[{ "index": 1, "root_cause": "...", "suggested_fix": "..." }, ...]

Errors:
${errorSummaries}`,
      },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return errors.map((e) => ({ error: e, root_cause: 'Parse error', suggested_fix: 'N/A' }))

    const analyses = JSON.parse(jsonMatch[0]) as Array<{
      index: number
      root_cause: string
      suggested_fix: string
    }>

    return errors.slice(0, 15).map((e, i) => {
      const analysis = analyses.find((a) => a.index === i + 1)
      return {
        error: e,
        root_cause: analysis?.root_cause || 'No analysis',
        suggested_fix: analysis?.suggested_fix || 'N/A',
      }
    })
  } catch {
    console.error('[prod-errors] Failed to parse Claude response')
    return errors.map((e) => ({ error: e, root_cause: 'Parse error', suggested_fix: 'N/A' }))
  }
}

export async function runProductionErrorsAudit() {
  console.log('[prod-errors] Starting production errors audit...')
  const admin = createAdminClient()

  // 1. Fetch from Sentry
  const sentryIssues = await fetchSentryIssues()
  console.log(`[prod-errors] Fetched ${sentryIssues.length} Sentry issues`)

  if (sentryIssues.length === 0) {
    console.log('[prod-errors] No issues found, skipping')
    return
  }

  // 2. Normalize
  const normalized = normalizeSentryIssues(sentryIssues)

  // 3. Dedupe against existing production_errors by cluster_signature
  const signatures = normalized.map((e) => e.cluster_signature)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('production_errors')
    .select('cluster_signature, id, occurrence_count')
    .in('cluster_signature', signatures)

  const existingMap = new Map<string, { cluster_signature: string; id: string; occurrence_count: number }>(
    (existing ?? []).map((e: { cluster_signature: string; id: string; occurrence_count: number }) => [
      e.cluster_signature,
      e,
    ])
  )

  // 4. Separate new vs existing
  const newErrors = normalized.filter((e) => !existingMap.has(e.cluster_signature))
  const updatedErrors = normalized.filter((e) => existingMap.has(e.cluster_signature))

  // Update existing error counts
  for (const err of updatedErrors) {
    const prev = existingMap.get(err.cluster_signature)!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateQuery = (admin as any).from('production_errors')
    await updateQuery
      .update({
        occurrence_count: err.occurrence_count,
        affected_users_count: err.affected_users_count,
        last_seen_at: err.last_seen_at,
      })
      .eq('id', prev.id)
  }

  console.log(`[prod-errors] ${newErrors.length} new, ${updatedErrors.length} updated`)

  // 5. Filter significant errors (>= MIN_OCCURRENCES)
  const significant = normalized.filter((e) => e.occurrence_count >= MIN_OCCURRENCES_FOR_FINDING)
  console.log(`[prod-errors] ${significant.length} errors with >= ${MIN_OCCURRENCES_FOR_FINDING} occurrences`)

  // 6. AI analysis on significant errors
  let analyzed: Array<{ error: NormalizedError; root_cause: string; suggested_fix: string }> = []
  if (significant.length > 0) {
    analyzed = await analyzeWithClaude(significant)
  }

  // 7. Insert new errors into production_errors table
  for (const err of newErrors) {
    const analysis = analyzed.find((a) => a.error.cluster_signature === err.cluster_signature)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('production_errors')
      .insert({
        ...err,
        ai_root_cause: analysis?.root_cause || null,
        ai_suggested_fix: analysis?.suggested_fix || null,
      })
  }

  // 8. Create findings for significant new errors
  let findingsCreated = 0
  for (const item of analyzed) {
    const { error: err, root_cause, suggested_fix } = item
    // Only create finding for new significant errors
    if (!existingMap.has(err.cluster_signature) && err.occurrence_count >= MIN_OCCURRENCES_FOR_FINDING) {
      const severity = classifySeverity(err.occurrence_count)
      await insertFinding({
        agent_type: 'technical',
        severity,
        title: `[PROD] ${err.error_type}: ${err.error_message.slice(0, 100)}`,
        description: `Production error detected via Sentry (${err.occurrence_count} occurrences, ${err.affected_users_count} users affected).\n\n**Root cause:** ${root_cause}\n**Suggested fix:** ${suggested_fix}`,
        location: err.affected_file || undefined,
        suggested_fix: suggested_fix,
      })
      findingsCreated++
    }
  }

  console.log(`[prod-errors] Created ${findingsCreated} findings`)

  // 9. Discord spike alert
  const spikes = normalized.filter((e) => e.occurrence_count >= SPIKE_THRESHOLD)
  for (const spike of spikes) {
    await sendDiscordAlert({
      severity: 'critical',
      agent_type: 'production_errors',
      title: `ERROR SPIKE — ${spike.error_type}: ${spike.occurrence_count} occurrences`,
      description: `${spike.error_message}\nAffected users: ${spike.affected_users_count}\nFile: ${spike.affected_file || 'unknown'}`,
      location: spike.affected_file || undefined,
    })
  }

  console.log('[prod-errors] Production errors audit complete')
}
