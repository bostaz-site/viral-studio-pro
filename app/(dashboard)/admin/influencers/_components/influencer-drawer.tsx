'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  X, ExternalLink, Mail, Globe, Tag, CalendarClock,
  ThumbsUp, ThumbsDown, ShieldBan, CheckCircle2,
  Send, Eye, MousePointerClick, MessageSquare, AlertTriangle,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// ── Types ────────────────────────────────────────────────────────────────────

interface Influencer {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  display_name: string | null
  primary_platform: string | null
  platform_handle: string | null
  platform_url: string | null
  audience_size: number | null
  niche: string | null
  country: string | null
  language: string | null
  status: string
  status_changed_at: string | null
  lead_score: number
  lead_score_reasons: unknown[] | null
  tags: string[]
  notes: string | null
  source: string | null
  has_opened: boolean
  has_clicked: boolean
  has_replied: boolean
  has_bounced: boolean
  has_unsubscribed: boolean
  last_sent_at: string | null
  last_opened_at: string | null
  last_replied_at: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  reply_reviewed: boolean
  total_emails_sent: number
  total_emails_opened: number
  total_emails_replied: number
  ai_affiliate_score: number | null
  ai_recommendation: string | null
  affiliate_code: string | null
  unsubscribed: boolean
  created_at: string
  updated_at: string
}

interface EmailEvent {
  id: string
  event_type: string
  occurred_at: string
  metadata: Record<string, unknown> | null
  campaign_id: string | null
}

const STATUSES = [
  'unqualified', 'cold', 'queued', 'contacted', 'opened', 'replied',
  'interested', 'demo_sent', 'evaluating', 'onboarded', 'active',
  'paying', 'dormant', 'declined', 'blocked',
]

const STATUS_COLORS: Record<string, string> = {
  unqualified: 'bg-zinc-700 text-zinc-300',
  cold: 'bg-blue-900/60 text-blue-300',
  queued: 'bg-cyan-900/60 text-cyan-300',
  contacted: 'bg-sky-900/60 text-sky-300',
  opened: 'bg-indigo-900/60 text-indigo-300',
  replied: 'bg-yellow-900/60 text-yellow-300',
  interested: 'bg-amber-900/60 text-amber-300',
  demo_sent: 'bg-orange-900/60 text-orange-300',
  evaluating: 'bg-fuchsia-900/60 text-fuchsia-300',
  onboarded: 'bg-emerald-900/60 text-emerald-300',
  active: 'bg-green-900/60 text-green-300',
  paying: 'bg-lime-900/60 text-lime-200',
  dormant: 'bg-stone-800 text-stone-400',
  declined: 'bg-red-900/60 text-red-300',
  blocked: 'bg-red-950 text-red-400',
}

const EVENT_ICONS: Record<string, typeof Send> = {
  sent: Send,
  delivered: Send,
  opened: Eye,
  clicked: MousePointerClick,
  replied: MessageSquare,
  bounced_hard: AlertTriangle,
  bounced_soft: AlertTriangle,
  unsubscribed: ShieldBan,
  spam_complaint: ShieldBan,
}

const EVENT_COLORS: Record<string, string> = {
  sent: 'text-zinc-400',
  delivered: 'text-zinc-400',
  opened: 'text-blue-400',
  clicked: 'text-cyan-400',
  replied: 'text-green-400',
  bounced_hard: 'text-red-400',
  bounced_soft: 'text-orange-400',
  unsubscribed: 'text-red-400',
  spam_complaint: 'text-red-500',
}

interface DrawerProps {
  influencer: Influencer
  onClose: () => void
  onUpdate: () => void
}

export function InfluencerDrawer({ influencer, onClose, onUpdate }: DrawerProps) {
  const [status, setStatus] = useState(influencer.status)
  const [notes, setNotes] = useState(influencer.notes || '')
  const [tags, setTags] = useState<string[]>(influencer.tags || [])
  const [newTag, setNewTag] = useState('')
  const [followUpDate, setFollowUpDate] = useState(
    influencer.next_follow_up_at ? influencer.next_follow_up_at.slice(0, 16) : ''
  )
  const [saving, setSaving] = useState(false)
  const [events, setEvents] = useState<EmailEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)

  // Reset state when influencer changes
  useEffect(() => {
    setStatus(influencer.status)
    setNotes(influencer.notes || '')
    setTags(influencer.tags || [])
    setFollowUpDate(influencer.next_follow_up_at ? influencer.next_follow_up_at.slice(0, 16) : '')
  }, [influencer])

  // Fetch email events
  useEffect(() => {
    setEventsLoading(true)
    fetch(`/api/admin/influencers/${influencer.id}/events`)
      .then(r => r.json())
      .then(d => setEvents(d.data?.events || []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false))
  }, [influencer.id])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const saveField = useCallback(async (field: string, value: unknown) => {
    setSaving(true)
    try {
      await fetch(`/api/admin/influencers/${influencer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      onUpdate()
    } catch { /* ignore */ }
    setSaving(false)
  }, [influencer.id, onUpdate])

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    await saveField('status', newStatus)
  }

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    const updated = [...tags, tag]
    setTags(updated)
    setNewTag('')
    saveField('tags', updated)
  }

  const handleRemoveTag = (tag: string) => {
    const updated = tags.filter(t => t !== tag)
    setTags(updated)
    saveField('tags', updated)
  }

  const handleSaveNotes = () => saveField('notes', notes)

  const handleSaveFollowUp = () => {
    const val = followUpDate ? new Date(followUpDate).toISOString() : null
    saveField('next_follow_up_at', val)
  }

  const name = influencer.display_name || `${influencer.first_name || ''} ${influencer.last_name || ''}`.trim() || 'Unknown'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-card border-b border-border">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{name}</h2>
            {influencer.platform_handle && (
              <p className="text-sm text-muted-foreground">@{influencer.platform_handle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saving && <WolfLoader variant="spinner" size={16} mode="system" />}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 text-green-400 border-green-500/30"
              onClick={() => handleStatusChange('interested')}>
              <ThumbsUp className="h-3.5 w-3.5" /> Interested
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1.5 text-red-400 border-red-500/30"
              onClick={() => handleStatusChange('declined')}>
              <ThumbsDown className="h-3.5 w-3.5" /> Declined
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1.5 text-red-500 border-red-600/30"
              onClick={() => handleStatusChange('blocked')}>
              <ShieldBan className="h-3.5 w-3.5" /> Block
            </Button>
            {!influencer.reply_reviewed && influencer.has_replied && (
              <Button size="sm" variant="outline" className="text-xs gap-1.5 text-amber-400 border-amber-500/30"
                onClick={() => saveField('reply_reviewed', true)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Reply reviewed
              </Button>
            )}
          </div>

          {/* Profile info */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Email" value={
              influencer.email ? (
                <a href={`mailto:${influencer.email}`} className="text-blue-400 hover:underline text-xs break-all">
                  {influencer.email}
                </a>
              ) : <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">Missing</Badge>
            } />
            <InfoRow label="Platform" value={
              <div className="flex items-center gap-1.5">
                <span className="text-xs capitalize">{influencer.primary_platform || '—'}</span>
                {influencer.platform_url && (
                  <a href={influencer.platform_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </div>
            } />
            <InfoRow label="Audience" value={
              <span className="text-xs tabular-nums">
                {influencer.audience_size ? formatNumber(influencer.audience_size) : '—'}
              </span>
            } />
            <InfoRow label="Niche" value={<span className="text-xs">{influencer.niche || '—'}</span>} />
            <InfoRow label="Country" value={<span className="text-xs">{influencer.country || '—'}</span>} />
            <InfoRow label="Language" value={<span className="text-xs">{influencer.language || '—'}</span>} />
            <InfoRow label="Score" value={<ScoreBadge score={influencer.lead_score} />} />
            <InfoRow label="AI Score" value={
              influencer.ai_affiliate_score != null
                ? <ScoreBadge score={influencer.ai_affiliate_score} />
                : <span className="text-xs text-zinc-500">—</span>
            } />
            <InfoRow label="Source" value={<span className="text-xs">{influencer.source || '—'}</span>} />
            <InfoRow label="Created" value={
              <span className="text-xs text-muted-foreground">{new Date(influencer.created_at).toLocaleDateString()}</span>
            } />
          </div>

          {/* Engagement signals */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Engagement</h3>
            <div className="flex flex-wrap gap-1.5">
              <EngagementBadge label="Sent" count={influencer.total_emails_sent} icon={Send} />
              <EngagementBadge label="Opened" active={influencer.has_opened} icon={Eye} />
              <EngagementBadge label="Clicked" active={influencer.has_clicked} icon={MousePointerClick} />
              <EngagementBadge label="Replied" active={influencer.has_replied} icon={MessageSquare} positive />
              <EngagementBadge label="Bounced" active={influencer.has_bounced} icon={AlertTriangle} negative />
              <EngagementBadge label="Unsubscribed" active={influencer.has_unsubscribed} icon={ShieldBan} negative />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
            <select
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-300">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-zinc-500">No tags</span>}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="h-8 text-xs flex-1"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddTag}>
                <Tag className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Follow-up date */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Next follow-up
            </label>
            <div className="flex gap-1.5">
              <Input
                type="datetime-local"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveFollowUp}>
                Save
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-20 px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground resize-none"
              placeholder="Internal notes..."
            />
            <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={handleSaveNotes}>
              Save notes
            </Button>
          </div>

          {/* Email timeline */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Email Timeline
            </h3>
            {eventsLoading ? (
              <div className="flex items-center justify-center py-6">
                <WolfLoader variant="spinner" size={16} mode="system" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No email events</p>
            ) : (
              <div className="space-y-0">
                {events.map((ev, i) => {
                  const Icon = EVENT_ICONS[ev.event_type] || Mail
                  const color = EVENT_COLORS[ev.event_type] || 'text-zinc-500'
                  return (
                    <div key={ev.id} className="flex items-start gap-3 py-2">
                      <div className="flex flex-col items-center">
                        <div className={`p-1 rounded-full bg-zinc-800/60 ${color}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        {i < events.length - 1 && (
                          <div className="w-px h-full min-h-[16px] bg-zinc-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {ev.event_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(ev.occurred_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : score >= 40 ? 'text-yellow-500' : 'text-zinc-500'
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{score}</span>
}

function EngagementBadge({ label, count, active, icon: Icon, positive, negative }: {
  label: string
  count?: number
  active?: boolean
  icon: typeof Send
  positive?: boolean
  negative?: boolean
}) {
  const isActive = count ? count > 0 : active
  let color = 'border-zinc-800 text-zinc-600'
  if (isActive && positive) color = 'border-green-500/30 text-green-400 bg-green-500/5'
  else if (isActive && negative) color = 'border-red-500/30 text-red-400 bg-red-500/5'
  else if (isActive) color = 'border-zinc-600 text-zinc-300 bg-zinc-800/50'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
      {count !== undefined && count > 0 && <span className="font-bold">{count}</span>}
    </span>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
