"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Scissors,
  TrendingUp,
  Share,
  Video,
  Clock,
  ArrowRight,
  Play,
  BarChart3,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  totalVideos: number
  totalClips: number
  avgViralScore: number
  thisMonthVideos: number
}

interface RecentClip {
  id: string
  title: string | null
  duration_seconds: number | null
  status: string
  created_at: string
  viral_scores: { score: number }[]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getScoreBadge(score: number) {
  if (score >= 70) return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' }
  if (score >= 40) return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }
  return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalClips: 0,
    avgViralScore: 0,
    thisMonthVideos: 0,
  })
  const [recentClips, setRecentClips] = useState<RecentClip[]>([])
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setUserName(
          (user.user_metadata?.full_name as string)?.split(' ')[0] ?? user.email?.split('@')[0] ?? ''
        )

        // Fetch stats in parallel
        const [videosRes, clipsRes, scoresRes] = await Promise.all([
          supabase.from('videos').select('id, created_at').eq('user_id', user.id),
          supabase.from('clips').select('id, title, duration_seconds, status, created_at, viral_scores(score)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
          supabase.from('clips').select('viral_scores(score)').eq('user_id', user.id),
        ])

        const videos = videosRes.data ?? []
        const clips = clipsRes.data ?? []
        const allClipsWithScores = scoresRes.data ?? []

        // Calculate avg viral score
        const allScores = allClipsWithScores
          .flatMap((c: Record<string, unknown>) => (c.viral_scores as { score: number }[]) ?? [])
          .map((vs: { score: number }) => vs.score)
          .filter((s: number) => s > 0)
        const avgScore = allScores.length > 0
          ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length)
          : 0

        // Count this month's videos
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const thisMonthCount = videos.filter((v: { created_at: string | null }) => (v.created_at ?? '') >= monthStart).length

        setStats({
          totalVideos: videos.length,
          totalClips: allClipsWithScores.length,
          avgViralScore: avgScore,
          thisMonthVideos: thisMonthCount,
        })

        setRecentClips(clips as unknown as RecentClip[])
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const statCards = [
    { label: 'Vidéos traitées', value: stats.totalVideos, icon: Video, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Clips générés', value: stats.totalClips, icon: Scissors, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Score viral moyen', value: stats.avgViralScore, icon: BarChart3, color: 'text-green-400', bg: 'bg-green-500/10', suffix: '/100' },
    { label: 'Ce mois-ci', value: stats.thisMonthVideos, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', suffix: ' vidéos' },
  ]

  const quickActions = [
    { label: 'Créer des clips', description: 'Uploadez ou importez une vidéo', href: '/create', icon: Scissors, gradient: 'from-blue-600 to-indigo-600' },
    { label: 'Explorer les tendances', description: 'Trouvez du contenu viral à remixer', href: '/trending', icon: TrendingUp, gradient: 'from-purple-600 to-pink-600' },
    { label: 'Publier', description: 'Distribuez vos clips partout', href: '/publish', icon: Share, gradient: 'from-green-600 to-teal-600' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {loading ? 'Dashboard' : `Salut ${userName} !`}
        </h1>
        <p className="text-muted-foreground mt-1">
          Votre centre de commande pour créer du contenu viral.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-card/60 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground leading-tight">
                    {loading ? '—' : stat.value}{!loading && stat.suffix && <span className="text-sm font-normal text-muted-foreground">{stat.suffix}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Actions rapides</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="bg-card/60 border-border hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-md`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-auto" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Clips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Clips récents</h2>
          {recentClips.length > 0 && (
            <Link href="/create" className="text-sm text-primary hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card/60 border-border">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentClips.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentClips.map((clip) => {
              const score = clip.viral_scores?.[0]?.score ?? 0
              const badge = getScoreBadge(score)
              return (
                <Card key={clip.id} className="bg-card/60 border-border hover:border-primary/30 transition-all duration-200 group">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground flex-1">
                        {clip.title ?? 'Sans titre'}
                      </p>
                      {score > 0 && (
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
                          {score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(clip.duration_seconds)}
                      </span>
                      <span className={`capitalize ${clip.status === 'done' ? 'text-green-400' : clip.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {clip.status === 'done' ? 'Prêt' : clip.status === 'error' ? 'Erreur' : 'En cours'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="bg-card/60 border-border border-dashed">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Aucun clip encore</p>
                <p className="text-sm text-muted-foreground mt-1">Créez votre premier clip viral en quelques secondes.</p>
              </div>
              <Link href="/create">
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2 mt-2">
                  <Play className="h-4 w-4" />
                  Créer mon premier clip
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
