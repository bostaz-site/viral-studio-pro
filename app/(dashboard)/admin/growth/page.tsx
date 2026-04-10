'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Gift, Users, TrendingUp, AlertCircle, Loader2, Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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
  if (diffSec < 60) return `il y a ${diffSec}s`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `il y a ${diffD} j`
  return new Date(iso).toLocaleDateString('fr-FR')
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
          setError(json?.error ?? 'Erreur serveur')
          return
        }
        setData(json.data)
      } catch {
        if (!cancelled) setError('Impossible de charger les données.')
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <p className="font-medium text-foreground">Impossible de charger les données</p>
              <p className="text-sm text-muted-foreground mt-1">{error ?? 'Erreur inconnue'}</p>
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
          Newsletter leads et parrainages — réservé aux admins.
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
          label="Leads (14 j)"
          value={data.newsletter.last14d}
          accent
        />
        <StatCard
          icon={<Gift className="h-4 w-4" />}
          label="Signups via parrainage"
          value={data.referrals.totalSignupsViaReferral}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Parrains actifs"
          value={data.referrals.uniqueReferrers}
        />
      </div>

      {/* Top referrers */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Top parrains
        </h2>
        {data.referrals.topReferrers.length === 0 ? (
          <Card className="bg-card/40">
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              Personne n&apos;a encore parrainé quelqu&apos;un. Partage ton lien pour lancer la machine.
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
                    <p className="text-[10px] text-muted-foreground">invités</p>
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
          Derniers leads newsletter
        </h2>
        {data.newsletter.recent.length === 0 ? (
          <Card className="bg-card/40">
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              Aucun lead pour le moment.
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
