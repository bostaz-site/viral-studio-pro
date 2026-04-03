"use client"

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Share2, Users, Send, CalendarDays, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SocialConnect } from '@/components/publish/social-connect'
import { PublishForm } from '@/components/publish/publish-form'
import { ScheduleCalendar } from '@/components/publish/schedule-calendar'
import { ExportPanel } from '@/components/publish/export-panel'

interface SocialAccount {
  id: string
  platform: string
  username: string | null
  connected_at: string | null
}

// ── Tab nav ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'export', label: 'Exporter', icon: Download },
  { id: 'connect', label: 'Comptes connectés', icon: Users },
  { id: 'publish', label: 'Publier', icon: Send },
  { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
] as const

type Tab = (typeof TABS)[number]['id']

// ── Inner page (uses useSearchParams) ─────────────────────────────────────────

function PublishPageInner() {
  const searchParams = useSearchParams()
  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  const [activeTab, setActiveTab] = useState<Tab>('export')
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/social/accounts')
      const json = await res.json() as { data: SocialAccount[] | null }
      setAccounts(json.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // After OAuth redirect, switch to connect tab so user sees the new account
  useEffect(() => {
    if (connectedParam) setActiveTab('connect')
  }, [connectedParam])

  const handleDisconnect = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-pink-500/20 rounded-xl ring-1 ring-border">
          <Share2 className="h-8 w-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exporter &amp; Publier</h1>
          <p className="text-muted-foreground mt-0.5">
            Exportez vos clips avec captions IA, ou publiez directement sur vos réseaux.
          </p>
        </div>
      </div>

      {/* OAuth feedback */}
      {connectedParam && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-400">
              Compte <span className="font-semibold capitalize">{connectedParam}</span> connecté avec succès !
            </p>
          </CardContent>
        </Card>
      )}
      {errorParam && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">
              Erreur : {decodeURIComponent(errorParam)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'export' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Exporter un clip</h2>
            <p className="text-sm text-muted-foreground">
              Téléchargez votre vidéo et copiez les captions optimisées pour poster manuellement.
            </p>
          </div>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-6">
              <ExportPanel />
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === 'connect' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Mes comptes connectés</h2>
            <p className="text-sm text-muted-foreground">
              Connectez vos réseaux sociaux pour publier directement depuis Viral Studio Pro.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des comptes…
            </div>
          ) : (
            <SocialConnect accounts={accounts} onDisconnect={handleDisconnect} />
          )}

          <Separator />

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {(['tiktok', 'instagram', 'youtube'] as const).map((p) => {
              const acc = accounts.find((a) => a.platform === p)
              return (
                <Card key={p} className="bg-card/30 border-border">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground capitalize">{p}</p>
                    <p className={`text-sm font-medium mt-1 ${acc ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {acc ? `@${acc.username ?? 'connecté'}` : 'Non connecté'}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {activeTab === 'publish' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Publier un clip</h2>
            <p className="text-sm text-muted-foreground">
              Sélectionnez un clip, choisissez vos plateformes et générez des captions optimisées par Claude.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-border bg-card/30">
              <CardContent className="p-6 text-center space-y-3">
                <Share2 className="h-10 w-10 text-muted-foreground mx-auto" />
                <div>
                  <CardTitle className="text-base">Aucun compte connecté</CardTitle>
                  <CardDescription className="mt-1">
                    Connectez au moins un réseau social dans l&apos;onglet &quot;Comptes connectés&quot; pour publier.
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connect')}
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Connecter un compte →
                </button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/50 border-border">
              <CardContent className="p-6">
                <PublishForm
                  accounts={accounts}
                  onPublished={() => setActiveTab('calendar')}
                />
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {activeTab === 'calendar' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Calendrier de publications</h2>
            <p className="text-sm text-muted-foreground">
              Vue mensuelle de toutes vos publications planifiées et publiées.
            </p>
          </div>
          <ScheduleCalendar />
        </section>
      )}
    </div>
  )
}

// ── Export wrapped in Suspense (required for useSearchParams) ──────────────────

export default function PublishPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh] gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      }
    >
      <PublishPageInner />
    </Suspense>
  )
}
