'use client'

import { User, Globe, Hash, BarChart3, Clock, Mail, MessageSquare } from 'lucide-react'

interface Influencer {
  id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  status: string
  lead_score: number
  tags: string[]
  primary_platform: string | null
  platform_handle: string | null
  audience_size: number | null
  niche: string | null
  last_contacted_at: string | null
  total_emails_sent: number
  total_emails_replied: number
}

const STATUS_COLORS: Record<string, string> = {
  cold: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-sky-500/20 text-sky-400',
  replied: 'bg-green-500/20 text-green-400',
  interested: 'bg-emerald-500/20 text-emerald-400',
  demo_sent: 'bg-purple-500/20 text-purple-400',
  onboarded: 'bg-amber-500/20 text-amber-400',
  paying: 'bg-yellow-500/20 text-yellow-400',
  declined: 'bg-red-500/20 text-red-400',
  blocked: 'bg-red-700/20 text-red-500',
  dormant: 'bg-zinc-500/20 text-zinc-400',
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffH = Math.round((now - then) / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

export function InfluencerContextSidebar({ influencer }: { influencer: Influencer }) {
  const name = influencer.display_name || influencer.first_name || influencer.email.split('@')[0]

  return (
    <div className="w-64 border-l border-zinc-800 p-4 overflow-y-auto bg-zinc-950/50 flex-shrink-0">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-200 truncate">{name}</span>
        </div>
        <p className="text-xs text-zinc-500 truncate">{influencer.email}</p>
      </div>

      {/* Status */}
      <div className="mb-4">
        <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[influencer.status] || 'bg-zinc-700 text-zinc-400'}`}>
          {influencer.status}
        </span>
      </div>

      {/* Lead score */}
      <div className="mb-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">Lead Score</span>
          <span className={`text-lg font-bold ${scoreColor(influencer.lead_score)}`}>
            {influencer.lead_score}
          </span>
        </div>
        <div className="w-full bg-zinc-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              influencer.lead_score >= 75 ? 'bg-green-500' :
              influencer.lead_score >= 50 ? 'bg-amber-500' :
              influencer.lead_score >= 25 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${influencer.lead_score}%` }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 text-xs">
        {influencer.primary_platform && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-400">{influencer.primary_platform}</span>
            {influencer.platform_handle && (
              <span className="text-zinc-500">@{influencer.platform_handle}</span>
            )}
          </div>
        )}

        {influencer.niche && (
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-400">{influencer.niche}</span>
          </div>
        )}

        {influencer.audience_size != null && (
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-400">
              {influencer.audience_size >= 1000
                ? `${(influencer.audience_size / 1000).toFixed(1)}K`
                : influencer.audience_size} followers
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-zinc-400">
            Last contact: {formatRelative(influencer.last_contacted_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-zinc-400">{influencer.total_emails_sent} sent</span>
        </div>

        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-zinc-400">{influencer.total_emails_replied} replies</span>
        </div>
      </div>

      {/* Tags */}
      {influencer.tags && influencer.tags.length > 0 && (
        <div className="mt-4">
          <span className="text-[10px] uppercase text-zinc-500 font-medium">Tags</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {influencer.tags.map(tag => (
              <span
                key={tag}
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  tag === 'hot'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
