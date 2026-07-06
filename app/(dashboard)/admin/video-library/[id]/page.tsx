'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Film, Clock, Maximize, HardDrive, Play, Pause, Archive, BarChart3, Eye, Users, DollarSign } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { TagEditor } from '../_components/tag-editor'

interface VideoDetail {
  id: string
  title: string
  description: string | null
  video_signed_url: string | null
  thumbnail_signed_url: string | null
  storage_path: string
  duration_seconds: number | null
  width: number | null
  height: number | null
  aspect_ratio: string | null
  codec: string | null
  file_size_bytes: number | null
  niche: string[]
  hook_type: string | null
  tone: string | null
  language: string
  status: string
  total_kits_generated: number
  total_views: number
  total_posts: number
  total_signups: number
  avg_engagement_rate: number | null
  created_at: string
  assets: Array<{ id: string; asset_type: string; storage_path: string; signed_url: string | null }>
  performance: Array<{
    date: string; kits_generated: number; kit_views: number
    video_completions: number; code_copies: number; posts_submitted: number
    signups_attributed: number; revenue_cents: number
  }>
}

export default function VideoDetailPage() {
  const router = useRouter()
  const params = useParams()
  const videoId = params.id as string
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      }).catch(() => router.push('/dashboard'))
    })
  }, [router])

  useEffect(() => {
    if (!authorized || !videoId) return
    async function load() {
      try {
        const res = await fetch(`/api/admin/video-library/${videoId}`, { cache: 'no-store' })
        const json = await res.json()
        if (json.data) setVideo(json.data)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authorized, videoId])

  const handleStatusChange = async (newStatus: string) => {
    if (!video) return
    const method = newStatus === 'archived' ? 'DELETE' : 'PUT'
    await fetch(`/api/admin/video-library/${videoId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setVideo(v => v ? { ...v, status: newStatus } : v)
  }

  if (loading) {
    return <div className="flex justify-center py-24"><WolfLoader variant="spinner" size={32} mode="amber" /></div>
  }
  if (!video) {
    return <div className="text-center py-12 text-zinc-500">Video not found</div>
  }

  const formatDuration = (s: number | null) => {
    if (!s) return '--'
    const mins = Math.floor(s / 60)
    const secs = Math.round(s % 60)
    return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
  }

  // Aggregate performance
  const perfTotals = video.performance.reduce(
    (acc, d) => ({
      kits: acc.kits + d.kits_generated,
      views: acc.views + d.kit_views,
      posts: acc.posts + d.posts_submitted,
      signups: acc.signups + d.signups_attributed,
      revenue: acc.revenue + Number(d.revenue_cents),
    }),
    { kits: 0, views: 0, posts: 0, signups: 0, revenue: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/admin/video-library')}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to library
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Film className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">{video.title}</h1>
            {video.description && <p className="text-xs text-zinc-500 mt-0.5">{video.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {video.status === 'active' ? (
            <button onClick={() => handleStatusChange('paused')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700">
              <Pause className="h-3 w-3" /> Pause
            </button>
          ) : video.status === 'paused' ? (
            <button onClick={() => handleStatusChange('active')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600/80 text-white text-xs rounded-md hover:bg-green-500">
              <Play className="h-3 w-3" /> Activate
            </button>
          ) : null}
          <button onClick={() => handleStatusChange('archived')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-red-400 text-xs rounded-md hover:bg-zinc-700">
            <Archive className="h-3 w-3" /> Archive
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video player */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {video.video_signed_url ? (
              <video
                src={video.video_signed_url}
                controls
                className="w-full aspect-video bg-black"
                poster={video.thumbnail_signed_url || undefined}
              />
            ) : (
              <div className="aspect-video bg-zinc-800 flex items-center justify-center">
                <Film className="h-12 w-12 text-zinc-600" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1"><Clock className="h-3 w-3 text-zinc-500" /><span className="text-[10px] text-zinc-500">Duration</span></div>
              <p className="text-sm font-medium text-zinc-200">{formatDuration(video.duration_seconds)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1"><Maximize className="h-3 w-3 text-zinc-500" /><span className="text-[10px] text-zinc-500">Resolution</span></div>
              <p className="text-sm font-medium text-zinc-200">{video.width && video.height ? `${video.width}x${video.height}` : '--'}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1"><Film className="h-3 w-3 text-zinc-500" /><span className="text-[10px] text-zinc-500">Aspect</span></div>
              <p className="text-sm font-medium text-zinc-200">{video.aspect_ratio || '--'}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1"><HardDrive className="h-3 w-3 text-zinc-500" /><span className="text-[10px] text-zinc-500">Size</span></div>
              <p className="text-sm font-medium text-zinc-200">{video.file_size_bytes ? `${(video.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : '--'}</p>
            </div>
          </div>

          {/* 30-day performance */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Performance (30 days)</h3>
            <div className="grid grid-cols-5 gap-3">
              <div><span className="text-[10px] text-zinc-500 flex items-center gap-1"><BarChart3 className="h-2.5 w-2.5" />Kits</span><p className="text-lg font-semibold text-zinc-200">{perfTotals.kits}</p></div>
              <div><span className="text-[10px] text-zinc-500 flex items-center gap-1"><Eye className="h-2.5 w-2.5" />Views</span><p className="text-lg font-semibold text-zinc-200">{perfTotals.views}</p></div>
              <div><span className="text-[10px] text-zinc-500 flex items-center gap-1"><Play className="h-2.5 w-2.5" />Posts</span><p className="text-lg font-semibold text-zinc-200">{perfTotals.posts}</p></div>
              <div><span className="text-[10px] text-zinc-500 flex items-center gap-1"><Users className="h-2.5 w-2.5" />Signups</span><p className="text-lg font-semibold text-zinc-200">{perfTotals.signups}</p></div>
              <div><span className="text-[10px] text-zinc-500 flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" />Revenue</span><p className="text-lg font-semibold text-zinc-200">${(perfTotals.revenue / 100).toFixed(0)}</p></div>
            </div>
          </div>
        </div>

        {/* Right: Tags + status */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Tags & Targeting</h3>
            <TagEditor
              videoId={video.id}
              currentNiche={video.niche}
              currentHookType={video.hook_type}
              currentTone={video.tone}
              currentLanguage={video.language}
              onSaved={() => {
                // Refresh
                fetch(`/api/admin/video-library/${videoId}`, { cache: 'no-store' })
                  .then(r => r.json())
                  .then(j => { if (j.data) setVideo(j.data) })
              }}
            />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Status</h3>
            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
              video.status === 'active' ? 'bg-green-400/10 text-green-400' :
              video.status === 'paused' ? 'bg-amber-400/10 text-amber-400' :
              'bg-zinc-700 text-zinc-400'
            }`}>
              {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
            </span>
            <p className="text-[10px] text-zinc-600 mt-2">
              Created {new Date(video.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
