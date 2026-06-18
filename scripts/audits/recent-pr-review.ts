/**
 * Recent PR Review Agent — runs DAILY
 *
 * Reviews PRs merged to master in last 7 days that haven't been reviewed yet.
 * Uses Claude Opus for staff-engineer-level code review.
 *
 * 1. Fetch merged PRs via GitHub API (last 7 days, not yet in pr_reviews)
 * 2. For each PR: fetch diff, ask Claude to review
 * 3. Save review to pr_reviews table
 * 4. For high+ severity issues, create audit findings
 * 5. Cross-reference patterns across PRs
 *
 * Run: npx tsx scripts/audits/recent-pr-review.ts
 */

import { createAdminClient } from '../../lib/supabase/admin'
import { claude } from '../../lib/audit/agent-runner'
import { insertFinding } from '../../lib/audit/insert-finding'

const OWNER = 'bostaz-site'
const REPO = 'viral-studio-pro'
const MAX_PRS_PER_RUN = 10

interface PRFromGitHub {
  number: number
  title: string
  html_url: string
  merged_at: string
  user: { login: string } | null
  changed_files?: number
  additions?: number
  deletions?: number
}

interface ReviewIssue {
  severity: 'critical' | 'high' | 'normal' | 'low'
  category: string
  description: string
  location: string
  suggested_fix: string
}

interface ReviewPattern {
  pattern_name: string
  occurrences_description: string
  refactor_suggestion: string
}

interface SecurityConcern {
  severity: 'critical' | 'high' | 'normal' | 'low'
  description: string
  location: string
  remediation: string
}

interface PerfConcern {
  severity: 'critical' | 'high' | 'normal' | 'low'
  description: string
  location: string
  suggestion: string
}

interface ReviewResult {
  review_summary: string
  overall_grade: 'A' | 'B' | 'C' | 'D' | 'F'
  issues_found: ReviewIssue[]
  patterns_detected: ReviewPattern[]
  security_concerns: SecurityConcern[]
  perf_concerns: PerfConcern[]
}

async function fetchGitHub(path: string, accept?: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not set')

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: accept || 'application/vnd.github+json',
  }

  return fetch(`https://api.github.com${path}`, { headers })
}

async function fetchMergedPRs(): Promise<PRFromGitHub[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const res = await fetchGitHub(
    `/repos/${OWNER}/${REPO}/pulls?state=closed&base=master&sort=updated&direction=desc&per_page=30`
  )
  if (!res.ok) {
    throw new Error(`GitHub API failed (${res.status}): ${await res.text()}`)
  }

  const prs: PRFromGitHub[] = await res.json()
  return prs.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) > new Date(sevenDaysAgo)
  )
}

async function fetchPRDetails(prNumber: number): Promise<{ files_changed: number; additions: number; deletions: number }> {
  const res = await fetchGitHub(`/repos/${OWNER}/${REPO}/pulls/${prNumber}`)
  if (!res.ok) return { files_changed: 0, additions: 0, deletions: 0 }
  const data = await res.json()
  return {
    files_changed: data.changed_files ?? 0,
    additions: data.additions ?? 0,
    deletions: data.deletions ?? 0,
  }
}

async function fetchPRDiff(prNumber: number): Promise<string> {
  const res = await fetchGitHub(
    `/repos/${OWNER}/${REPO}/pulls/${prNumber}`,
    'application/vnd.github.v3.diff'
  )
  if (!res.ok) {
    console.warn(`[pr-review] Failed to fetch diff for PR #${prNumber}: ${res.status}`)
    return ''
  }
  const diff = await res.text()
  // Truncate extremely large diffs to avoid token limits
  if (diff.length > 100_000) {
    return diff.slice(0, 100_000) + '\n\n[... diff truncated at 100k chars ...]'
  }
  return diff
}

async function reviewPR(pr: PRFromGitHub, diff: string): Promise<ReviewResult> {
  const response = await claude.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a staff engineer at Stripe reviewing a pull request for Viral Animal, a video editing SaaS built with Next.js 14, TypeScript, Supabase, and FFmpeg.

Review this PR like you're doing a thorough code review. Be honest but constructive.

## PR Info
- **Title**: ${pr.title}
- **Author**: ${pr.user?.login ?? 'unknown'}
- **Merged at**: ${pr.merged_at}

## Diff
\`\`\`diff
${diff}
\`\`\`

## What to check
1. **Code quality**: smells, dead code, unused imports, unclear naming, missing error handling
2. **Tests**: are there tests? Should there be? Are edge cases covered?
3. **Security**: secrets in code, SQL injection, XSS, missing auth checks, OWASP top 10
4. **Performance**: N+1 queries, unnecessary re-renders, missing indexes, large payloads
5. **Patterns**: repeated code that should be abstracted, inconsistent patterns
6. **Architecture**: does this fit the existing codebase patterns?

## Output
Return ONLY valid JSON (no markdown, no prose outside JSON):
{
  "review_summary": "1 paragraph summary of the PR quality and what it does",
  "overall_grade": "A" | "B" | "C" | "D" | "F",
  "issues_found": [
    {
      "severity": "critical" | "high" | "normal" | "low",
      "category": "code_quality" | "tests" | "security" | "performance" | "architecture" | "other",
      "description": "What's wrong",
      "location": "file:line or general area",
      "suggested_fix": "How to fix it"
    }
  ],
  "patterns_detected": [
    {
      "pattern_name": "Name of the repeated pattern",
      "occurrences_description": "Where it appears",
      "refactor_suggestion": "How to abstract it"
    }
  ],
  "security_concerns": [
    {
      "severity": "critical" | "high" | "normal" | "low",
      "description": "The security issue",
      "location": "Where",
      "remediation": "How to fix"
    }
  ],
  "perf_concerns": [
    {
      "severity": "critical" | "high" | "normal" | "low",
      "description": "The performance issue",
      "location": "Where",
      "suggestion": "How to optimize"
    }
  ]
}

Grading scale:
- A: Clean, well-tested, follows conventions, no issues
- B: Minor issues, mostly good
- C: Several issues that should be addressed
- D: Significant problems, needs rework
- F: Critical issues (security holes, data loss risks, broken logic)

If the PR is clean, return empty arrays for issues/patterns/concerns. Don't invent problems.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      review_summary: 'Failed to parse review output',
      overall_grade: 'C',
      issues_found: [],
      patterns_detected: [],
      security_concerns: [],
      perf_concerns: [],
    }
  }

  return JSON.parse(jsonMatch[0]) as ReviewResult
}

export async function runRecentPRReview() {
  const admin = createAdminClient()

  if (!process.env.GITHUB_TOKEN) {
    console.log('[pr-review] GITHUB_TOKEN not set, skipping')
    return
  }

  // 1. Fetch merged PRs from last 7 days
  const mergedPRs = await fetchMergedPRs()
  console.log(`[pr-review] Found ${mergedPRs.length} merged PRs in last 7 days`)

  if (mergedPRs.length === 0) return

  // 2. Filter out already-reviewed PRs
  const prNumbers = mergedPRs.map((pr) => pr.number)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingReviews } = await (admin as any)
    .from('pr_reviews')
    .select('pr_number')
    .in('pr_number', prNumbers)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviewedNumbers = new Set((existingReviews ?? []).map((r: any) => r.pr_number as number))
  const toReview = mergedPRs
    .filter((pr) => !reviewedNumbers.has(pr.number))
    // Skip auto-fix PRs (generated by the audit system itself)
    .filter((pr) => !pr.title.toLowerCase().includes('auto-fix'))
    .filter((pr) => !pr.title.toLowerCase().includes('[skip-review]'))
    .slice(0, MAX_PRS_PER_RUN)

  console.log(`[pr-review] ${toReview.length} PRs to review (${reviewedNumbers.size} already reviewed)`)

  if (toReview.length === 0) return

  let totalGradePoints = 0
  let reviewCount = 0
  const gradeMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }

  // 3. Review each PR
  for (const pr of toReview) {
    console.log(`[pr-review] Reviewing PR #${pr.number}: ${pr.title}`)

    try {
      const [diff, details] = await Promise.all([
        fetchPRDiff(pr.number),
        fetchPRDetails(pr.number),
      ])

      if (!diff) {
        console.warn(`[pr-review] Empty diff for PR #${pr.number}, skipping`)
        continue
      }

      const review = await reviewPR(pr, diff)

      // 4. Save to pr_reviews table
      const findingIds: string[] = []

      // Create findings for high+ severity issues
      for (const issue of review.issues_found ?? []) {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          const findingId = await insertFinding({
            agent_type: 'pr_review',
            severity: issue.severity,
            title: `PR #${pr.number}: ${issue.description.slice(0, 80)}`,
            description: `[${issue.category}] ${issue.description}\n\nPR: ${pr.title}`,
            location: issue.location,
            suggested_fix: issue.suggested_fix,
          })
          if (findingId) findingIds.push(findingId)
        }
      }

      // Create findings for critical security concerns
      for (const concern of review.security_concerns ?? []) {
        if (concern.severity === 'critical' || concern.severity === 'high') {
          const findingId = await insertFinding({
            agent_type: 'pr_review',
            severity: concern.severity,
            title: `PR #${pr.number} Security: ${concern.description.slice(0, 60)}`,
            description: `${concern.description}\n\nPR: ${pr.title}\nRemediation: ${concern.remediation}`,
            location: concern.location,
            suggested_fix: concern.remediation,
          })
          if (findingId) findingIds.push(findingId)
        }
      }

      // If grade is D or F, create a finding suggesting revert/refactor
      if (review.overall_grade === 'D' || review.overall_grade === 'F') {
        const findingId = await insertFinding({
          agent_type: 'pr_review',
          severity: review.overall_grade === 'F' ? 'critical' : 'high',
          title: `PR #${pr.number} graded ${review.overall_grade} — needs rework`,
          description: `${review.review_summary}\n\nConsider reverting or refactoring PR #${pr.number}: ${pr.title}`,
          location: pr.html_url,
          suggested_fix: `Review issues in PR #${pr.number} and either revert or submit a follow-up fix.`,
        })
        if (findingId) findingIds.push(findingId)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('pr_reviews').insert({
        pr_number: pr.number,
        pr_title: pr.title,
        pr_url: pr.html_url,
        merged_at: pr.merged_at,
        merged_by: pr.user?.login ?? null,
        files_changed: details.files_changed,
        lines_added: details.additions,
        lines_removed: details.deletions,
        review_summary: review.review_summary,
        issues_found: review.issues_found,
        patterns_detected: review.patterns_detected,
        security_concerns: review.security_concerns,
        perf_concerns: review.perf_concerns,
        overall_grade: review.overall_grade,
        follow_up_finding_ids: findingIds.length > 0 ? findingIds : null,
      })

      totalGradePoints += gradeMap[review.overall_grade] ?? 2
      reviewCount++

      const issueCount = (review.issues_found?.length ?? 0) +
        (review.security_concerns?.length ?? 0) +
        (review.perf_concerns?.length ?? 0)

      console.log(
        `[pr-review] PR #${pr.number}: grade ${review.overall_grade}, ${issueCount} issues, ${review.patterns_detected?.length ?? 0} patterns`
      )
    } catch (err) {
      console.error(`[pr-review] Failed to review PR #${pr.number}:`, err)
    }
  }

  // 5. Cross-reference patterns across recent reviews
  if (reviewCount > 0) {
    await detectRecurringPatterns(admin)
  }

  const avgGrade = reviewCount > 0 ? totalGradePoints / reviewCount : 0
  const avgLetter = avgGrade >= 3.5 ? 'A' : avgGrade >= 2.5 ? 'B' : avgGrade >= 1.5 ? 'C' : avgGrade >= 0.5 ? 'D' : 'F'
  console.log(`[pr-review] Done: ${reviewCount} PRs reviewed, average grade: ${avgLetter}`)
}

async function detectRecurringPatterns(admin: ReturnType<typeof createAdminClient>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentReviews } = await (admin as any)
    .from('pr_reviews')
    .select('pr_number, patterns_detected')
    .gte('reviewed_at', thirtyDaysAgo)
    .not('patterns_detected', 'is', null)

  if (!recentReviews || recentReviews.length < 2) return

  // Count pattern occurrences across PRs
  const patternCounts: Record<string, { count: number; prs: number[]; suggestion: string }> = {}

  for (const review of recentReviews) {
    const patterns = review.patterns_detected as ReviewPattern[] | null
    if (!patterns) continue

    for (const p of patterns) {
      const key = p.pattern_name.toLowerCase().trim()
      if (!patternCounts[key]) {
        patternCounts[key] = { count: 0, prs: [], suggestion: p.refactor_suggestion }
      }
      patternCounts[key].count++
      patternCounts[key].prs.push(review.pr_number)
    }
  }

  // Patterns seen in 3+ PRs → create a finding as refactor candidate
  for (const [name, info] of Object.entries(patternCounts)) {
    if (info.count >= 3) {
      console.log(`[pr-review] Recurring pattern "${name}" found in ${info.count} PRs → creating finding`)
      await insertFinding({
        agent_type: 'pr_review',
        severity: 'normal',
        title: `Refactor candidate: ${name} (seen in ${info.count} PRs)`,
        description: `Pattern "${name}" detected in PRs: ${info.prs.join(', ')}.\n\nSuggestion: ${info.suggestion}`,
        suggested_fix: info.suggestion,
      })
    }
  }
}

// Allow direct execution
if (require.main === module) {
  import('dotenv').then(({ config }) => {
    config({ path: '.env.local' })
    runRecentPRReview()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('[pr-review] Fatal:', err)
        process.exit(1)
      })
  })
}
