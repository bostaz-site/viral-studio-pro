'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Copy, Check, Loader2, ExternalLink, MousePointer, UserPlus, CreditCard, DollarSign, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface AffiliateData {
  id: string
  code: string
  custom_handle: string | null
  handle: string
  link: string
  clicks: number
  signups: number
  conversions: number
  total_earned: number
  commission_rate: number
  active: boolean
  created_at: string
}

interface ReferralEvent {
  id: string
  event_type: string
  amount: number | null
  created_at: string
}

const EVENT_LABELS: Record<string, { label: string; icon: typeof MousePointer; color: string }> = {
  click: { label: 'Click', icon: MousePointer, color: 'text-muted-foreground' },
  signup: { label: 'Signup', icon: UserPlus, color: 'text-blue-400' },
  conversion: { label: 'Conversion', icon: CreditCard, color: 'text-green-400' },
  payout: { label: 'Payout', icon: DollarSign, color: 'text-emerald-400' },
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function AffiliateSection() {
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null)
  const [events, setEvents] = useState<ReferralEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingHandle, setEditingHandle] = useState(false)
  const [newHandle, setNewHandle] = useState('')
  const [handleError, setHandleError] = useState<string | null>(null)
  const [savingHandle, setSavingHandle] = useState(false)

  const fetchAffiliate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/affiliate')
      if (!res.ok) return
      const json = await res.json() as { data: AffiliateData | null }
      if (json.data) {
        setAffiliate(json.data)
        setNewHandle(json.data.custom_handle || '')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    const res = await fetch('/api/affiliate/events?limit=5')
    if (!res.ok) return
    const json = await res.json() as { data: ReferralEvent[] }
    setEvents(json.data ?? [])
  }, [])

  useEffect(() => {
    fetchAffiliate()
    fetchEvents()
  }, [fetchAffiliate, fetchEvents])

  const handleCopy = () => {
    if (!affiliate) return
    navigator.clipboard.writeText(affiliate.link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSaveHandle = async () => {
    if (!newHandle.trim()) return
    setSavingHandle(true)
    setHandleError(null)

    try {
      const res = await fetch('/api/affiliate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_handle: newHandle.toLowerCase().trim() }),
      })
      const json = await res.json() as { data: { custom_handle: string; link: string } | null; error: string | null }

      if (!res.ok) {
        setHandleError(json.error || 'Failed to update handle')
        return
      }

      // Refresh data
      await fetchAffiliate()
      setEditingHandle(false)
    } finally {
      setSavingHandle(false)
    }
  }

  if (loading && !affiliate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Affiliate Program</h2>
        </div>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-5 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!affiliate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Affiliate Program</h2>
            <p className="text-sm text-muted-foreground">Earn 20% commission on every referral</p>
          </div>
        </div>
        <Card className="bg-card/50 border-border">
          <CardContent className="p-5 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Share your link, earn commissions when your referrals upgrade.
            </p>
            <Button onClick={fetchAffiliate} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Activate Affiliate Program
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Affiliate Program</h2>
          <p className="text-sm text-muted-foreground">
            {Math.round(affiliate.commission_rate * 100)}% commission on every conversion
          </p>
        </div>
      </div>

      <Card className="bg-card/50 border-border">
        <CardContent className="p-5 space-y-5">
          {/* Referral link */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Your referral link
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={affiliate.link}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5" /> Copied</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /> Copy</>
                )}
              </Button>
              <a
                href={affiliate.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>

          {/* Custom handle */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Custom handle
            </p>
            {editingHandle ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">viralanimal.com/ref/</span>
                  <Input
                    value={newHandle}
                    onChange={(e) => {
                      setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                      setHandleError(null)
                    }}
                    placeholder="your-handle"
                    className="font-mono text-xs"
                    maxLength={30}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveHandle}
                    disabled={savingHandle || newHandle.length < 3}
                  >
                    {savingHandle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingHandle(false)
                      setHandleError(null)
                      setNewHandle(affiliate.custom_handle || '')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {handleError && (
                  <p className="text-xs text-destructive">{handleError}</p>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  3-30 characters, lowercase letters, numbers and hyphens only
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">
                  {affiliate.custom_handle ? (
                    <span className="text-primary">{affiliate.custom_handle}</span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Using default: {affiliate.code}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() => setEditingHandle(true)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clicks</p>
              <p className="text-xl font-black text-foreground mt-0.5">{affiliate.clicks}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Signups</p>
              <p className="text-xl font-black text-foreground mt-0.5">{affiliate.signups}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conversions</p>
              <p className="text-xl font-black text-foreground mt-0.5">{affiliate.conversions}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Earned</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">
                ${affiliate.total_earned.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Recent events */}
          {events.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Recent activity
                </p>
                <div className="space-y-2">
                  {events.map((event) => {
                    const config = EVENT_LABELS[event.event_type] ?? EVENT_LABELS.click
                    const Icon = config.icon
                    return (
                      <div key={event.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                          <span className={`text-sm font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          {event.amount !== null && event.amount > 0 && (
                            <span className="text-xs text-emerald-400 font-mono">
                              +${Number(event.amount).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(event.created_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
