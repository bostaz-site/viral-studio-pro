'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronUp, ArrowLeft,
  GitPullRequest, Shield, Zap, Code2, TrendingUp,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import Link from 'next/link'

interface PRReview {
  id: string
  pr_number: number
  pr_title: string
  pr_url: string
  merged_at: string
  merged_by: string | null
  files_changed: number | null
  lines_added: number | null
  lines_removed: number | null
  review_summary: string | null
  issues_found: Array<{
    severity: string
    category: string
    description: string
    location: string
    suggested_fix: string
  }> | null
  patterns_detected: Array<{
    pattern_name: string
    occurrences_description: string
    refactor_suggestion: string
  }> | null
  security_concerns: Array<{
    severity: string
    description: string
    location: string
    remediation: string
  }> | null
  perf_concerns: Array<{
    severity: string
    description: string
    location: string
    suggestion: string
  }> | null
  overall_grade: string | null
  reviewed_at: string
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  B: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  C: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  F: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const GRADE_BG: Record<string, string> = {
  A: 'bg-emerald-500',
  B: 'bg-blue-500',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-yellow-400',
  low: 'text-zinc-400',
}

export default function PRReviewsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [reviews, setReviews] = useState<PRReview[]>([])
  const [loading, setLoading] = useState(true)
  const [gradeFilter, setGradeFilter] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (gradeFilter) params.set('grade', gradeFilter)
      if (authorFilter) params.set('author', authorFilter)

      const res = await fetch(`/api/admin/audits/pr-reviews?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setReviews(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [gradeFilter, authorFilter])

  useEffect(() => {
    if (authorized) loadReviews()
  }, [authorized, loadReviews])

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  // Compute stats
  const gradePoints: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
  const avgGrade = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (gradePoints[r.overall_grade ?? 'C'] ?? 2), 0) / reviews.length
    : 0
  const avgLetter = avgGrade >= 3.5 ? 'A' : avgGrade >= 2.5 ? 'B' : avgGrade >= 1.5 ? 'C' : avgGrade >= 0.5 ? 'D' : 'F'

  const gradeDist = reviews.reduce<Record<string, number>>((acc, r) => {
    const g = r.overall_grade ?? 'C'
    acc[g] = (acc[g] ?? 0) + 1
    return acc
  }, {})

  const totalIssues = reviews.reduce(
    (sum, r) => sum + (r.issues_found?.length ?? 0) + (r.security_concerns?.length ?? 0) + (r.perf_concerns?.length ?? 0),
    0
  )

  const authors = [...new Set(reviews.map((r) => r.merged_by).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/audits"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GitPullRequest className="h-6 w-6 text-indigo-400" />
              PR Reviews
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Staff-engineer-level AI review of your merged PRs (last 7 days)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Reviewed</p>
          <p className="text-2xl font-bold mt-1">{reviews.length}</p>
          <p className="text-xs text-zinc-500">PRs</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Avg Grade</p>
          <p className={`text-2xl font-bold mt-1 ${reviews.length > 0 ? (GRADE_BG[avgLetter]?.replace('bg-', 'text-') ?? 'text-zinc-400') : 'text-zinc-500'}`}>
            {reviews.length > 0 ? avgLetter : '-'}
          </p>
          <p className="text-xs text-zinc-500">{avgGrade.toFixed(1)} / 4.0</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Issues Found</p>
          <p className="text-2xl font-bold mt-1">{totalIssues}</p>
          <p className="text-xs text-zinc-500">across all PRs</p>
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Grade Dist.</p>
          <div className="flex gap-1.5 mt-2">
            {['A', 'B', 'C', 'D', 'F'].map((g) => (
              <div key={g} className="text-center">
                <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${GRADE_COLORS[g]}`}>
                  {g}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{gradeDist[g] ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All grades</option>
          {['A', 'B', 'C', 'D', 'F'].map((g) => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>
        <select
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a} value={a!}>{a}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="system" />
        </div>
      )}

      {/* Reviews list */}
      {!loading && reviews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <GitPullRequest className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">No PR reviews yet. The agent runs nightly.</p>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((r) => (
            <PRReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function PRReviewCard({ review }: { review: PRReview }) {
  const [expanded, setExpanded] = useState(false)
  const grade = review.overall_grade ?? 'C'
  const gradeColor = GRADE_COLORS[grade] ?? GRADE_COLORS.C
  const issueCount = (review.issues_found?.length ?? 0) +
    (review.security_concerns?.length ?? 0) +
    (review.perf_concerns?.length ?? 0)
  const patternCount = review.patterns_detected?.length ?? 0
  const mergedDate = new Date(review.merged_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="rounded-xl border border-zinc-800 p-4 transition-all hover:border-zinc-700">
      <div className="flex items-start gap-4">
        {/* Grade badge */}
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl border text-xl font-black shrink-0 ${gradeColor}`}>
          {grade}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-mono">#{review.pr_number}</span>
            <a
              href={review.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:text-indigo-400 transition-colors truncate"
            >
              {review.pr_title}
            </a>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            {review.merged_by && <span>by {review.merged_by}</span>}
            <span>{mergedDate}</span>
            {review.files_changed != null && (
              <span>{review.files_changed} files</span>
            )}
            {review.lines_added != null && review.lines_removed != null && (
              <span className="font-mono">
                <span className="text-emerald-500">+{review.lines_added}</span>
                {' '}
                <span className="text-red-400">-{review.lines_removed}</span>
              </span>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 mt-2">
            {issueCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-400">
                <Code2 className="h-3 w-3" />
                {issueCount} issues
              </span>
            )}
            {(review.security_concerns?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <Shield className="h-3 w-3" />
                {review.security_concerns!.length} security
              </span>
            )}
            {(review.perf_concerns?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Zap className="h-3 w-3" />
                {review.perf_concerns!.length} perf
              </span>
            )}
            {patternCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-violet-400">
                <TrendingUp className="h-3 w-3" />
                {patternCount} patterns
              </span>
            )}
            {issueCount === 0 && patternCount === 0 && (
              <span className="text-xs text-emerald-400">Clean PR</span>
            )}
          </div>

          {/* Expand */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less' : 'Full review'}
          </button>

          {expanded && (
            <div className="mt-4 space-y-4">
              {/* Summary */}
              {review.review_summary && (
                <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                  <p className="text-xs font-bold text-zinc-400 mb-1">Summary</p>
                  <p className="text-sm text-zinc-300">{review.review_summary}</p>
                </div>
              )}

              {/* Issues */}
              {(review.issues_found?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Issues</p>
                  <div className="space-y-2">
                    {review.issues_found!.map((issue, i) => (
                      <div key={i} className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-800/50">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase ${SEVERITY_COLORS[issue.severity] ?? 'text-zinc-400'}`}>
                            {issue.severity}
                          </span>
                          <span className="text-xs text-zinc-500">{issue.category}</span>
                        </div>
                        <p className="text-sm text-zinc-300 mt-1">{issue.description}</p>
                        {issue.location && (
                          <p className="text-xs text-zinc-500 font-mono mt-1">{issue.location}</p>
                        )}
                        {issue.suggested_fix && (
                          <p className="text-xs text-emerald-400 mt-1">Fix: {issue.suggested_fix}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security */}
              {(review.security_concerns?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Security Concerns</p>
                  <div className="space-y-2">
                    {review.security_concerns!.map((c, i) => (
                      <div key={i} className="bg-red-500/5 rounded-lg p-3 border border-red-500/20">
                        <span className={`text-xs font-bold uppercase ${SEVERITY_COLORS[c.severity]}`}>{c.severity}</span>
                        <p className="text-sm text-zinc-300 mt-1">{c.description}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{c.location}</p>
                        <p className="text-xs text-emerald-400 mt-1">Remediation: {c.remediation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Performance */}
              {(review.perf_concerns?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Performance Concerns</p>
                  <div className="space-y-2">
                    {review.perf_concerns!.map((c, i) => (
                      <div key={i} className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
                        <span className={`text-xs font-bold uppercase ${SEVERITY_COLORS[c.severity]}`}>{c.severity}</span>
                        <p className="text-sm text-zinc-300 mt-1">{c.description}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{c.location}</p>
                        <p className="text-xs text-emerald-400 mt-1">Suggestion: {c.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patterns */}
              {(review.patterns_detected?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">Patterns Detected</p>
                  <div className="space-y-2">
                    {review.patterns_detected!.map((p, i) => (
                      <div key={i} className="bg-violet-500/5 rounded-lg p-3 border border-violet-500/20">
                        <p className="text-sm font-semibold text-violet-300">{p.pattern_name}</p>
                        <p className="text-xs text-zinc-400 mt-1">{p.occurrences_description}</p>
                        <p className="text-xs text-emerald-400 mt-1">Refactor: {p.refactor_suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
