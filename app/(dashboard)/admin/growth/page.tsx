'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Gift, Users, TrendingUp, AlertCircle, Crown, ShieldCheck, X } from 'lucide-react'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

interface GrowthData {
  newsletter: {
    total: number
    last14d: number
    recent: Array<{ email: string; source: string | null; created_at: string }>
  }
  referrals: {
    totalSignupsViaReferral: number
    uniqueReferrers: number
    topReferrers: Array<{
      id: string
      email: string
      full_name: string | null
      referral_code: string | null
      plan: string | null
      invited_count: number
      created_at: string | null
    }>
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return new Date(iso).toLocaleDateString('en-US')
}

export default function AdminGrowthPage() {
  const router = useRouter()
  const [data, setData] = useState<GrowthData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/growth', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { data: GrowthData | null; error: string | null }
          | null

        if (cancelled) return
        if (res.status === 403 || res.status === 401) {
          router.replace('/dashboard')
          return
        }
        if (!res.ok || !json?.data) {
          setError(json?.error ?? 'Server error')
          return
        }
        setData(json.data)
      } catch {
        if (!cancelled) setError('Failed to load data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <WolfLoader variant="spinner" size={24} mode="amber" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Failed to load data</p>
              <p className="text-sm text-muted-foreground mt-1">{error ?? 'Unknown error'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Crown className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Admin</p>
        </div>
        <h1 className="text-3xl font-black tracking-tight">Growth</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Newsletter leads and referrals — admin only.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Mail className="h-4 w-4" />}
          label="Leads newsletter"
          value={data.newsletter.total}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Leads (14d)"
          value={data.newsletter.last14d}
          accent
        />
        <StatCard
          icon={<Gift className="h-4 w-4" />}
          label="Signups via referral"
          value={data.referrals.totalSignupsViaReferral}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active referrers"
          value={data.referrals.uniqueReferrers}
        />
      </div>

      {/* Top referrers */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Top referrers
        </h2>
        {data.referrals.topReferrers.length === 0 ? (
          <Card className="bg-card/40">
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No referrals yet. Share your link to get started!
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/40 overflow-hidden">
            <div className="divide-y divide-border/40">
              {data.referrals.topReferrers.map((r, i) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="text-xs font-bold w-5 text-muted-foreground">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.full_name || r.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.email}
                      {r.referral_code && (
                        <span className="ml-2 font-mono text-primary">{r.referral_code}</span>
                      )}
                    </p>
                  </div>
                  {r.plan && r.plan !== 'free' && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {r.plan}
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-lg font-black tabular-nums text-foreground">
                      {r.invited_count}
                    </p>
                    <p className="text-[10px] text-muted-foreground">invited</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Recent newsletter leads */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Recent newsletter leads
        </h2>
        {data.newsletter.recent.length === 0 ? (
          <Card className="bg-card/40">
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No leads yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/40 overflow-hidden">
            <div className="divide-y divide-border/40">
              {data.newsletter.recent.map((lead, i) => (
                <div key={`${lead.email}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-foreground flex-1 truncate">{lead.email}</p>
                  {lead.source && (
                    <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
                      {lead.source}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatRelative(lead.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Pack accounts — comp/free Pro for testers */}
      <PackAccountsSection />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <Card className="bg-card/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
          {icon}
          <span>{label}</span>
        </div>
        <p
          className={`text-3xl font-black tabular-nums ${
            accent
              ? 'bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent'
              : 'text-foreground'
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

// ── Pack Accounts Section ──

interface PackAccount {
  id: string
  email: string
  full_name: string | null
  comp_note: string | null
}

function PackAccountsSection() {
  const [accounts, setAccounts] = useState<PackAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, email, full_name, comp_note')
      .eq('is_comp', true)
      .order('updated_at', { ascending: false })
    setAccounts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const handleGrant = async () => {
    if (!email.trim()) return
    setGranting(true)
    setError(null)
    setSuccess(null)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error: fetchErr } = await (supabase as any)
        .from('profiles')
        .select('id, email')
        .eq('email', email.trim().toLowerCase())
        .single()
      if (fetchErr || !profile) {
        setError('No profile found with that email. The user must sign up first.')
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from('profiles')
        .update({ is_comp: true, comp_note: note.trim() || null })
        .eq('id', profile.id)
      if (updateErr) { setError(updateErr.message); return }
      setSuccess(`Pack granted to ${email}`)
      setEmail('')
      setNote('')
      loadAccounts()
    } catch { setError('Network error') } finally { setGranting(false) }
  }

  const handleRevoke = async (id: string) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({ is_comp: false, comp_note: null })
      .eq('id', id)
    loadAccounts()
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-400" />
        Pack accounts
        <span className="text-xs text-muted-foreground font-normal ml-1">Free Pro for testers — excluded from MRR</span>
      </h2>

      {/* Grant form */}
      <Card className="bg-card/40 mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Note (e.g. brother of Samy)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleGrant} disabled={granting || !email.trim()} size="sm">
              {granting ? <WolfLoader variant="spinner" size={14} mode="amber" /> : 'Grant'}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
          {success && <p className="text-xs text-emerald-400">{success}</p>}
        </CardContent>
      </Card>

      {/* Active pack accounts list */}
      {loading ? (
        <div className="text-center py-4"><WolfLoader variant="spinner" size={16} mode="amber" /></div>
      ) : accounts.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            No pack accounts yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/40 overflow-hidden">
          <div className="divide-y divide-border/40">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                <ViralAnimalLogo iconOnly size={16} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.full_name || a.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}{a.comp_note && ` — ${a.comp_note}`}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleRevoke(a.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  )
}
