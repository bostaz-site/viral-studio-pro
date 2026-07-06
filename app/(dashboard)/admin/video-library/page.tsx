'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Plus, Search, Filter } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { VideoCard } from './_components/video-card'
import { UploadDialog } from './_components/upload-dialog'

interface PromoVideo {
  id: string
  title: string
  thumbnail_signed_url: string | null
  duration_seconds: number | null
  aspect_ratio: string | null
  niche: string[]
  hook_type: string | null
  tone: string | null
  status: string
  total_kits_generated: number
  total_views: number
  total_posts: number
  total_signups: number
  created_at: string
}

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const NICHE_FILTERS = [
  '', 'ai_tools', 'productivity', 'gaming', 'creator_tools',
  'side_hustle', 'app_reviews', 'editing', 'streaming',
]

export default function VideoLibraryPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [videos, setVideos] = useState<PromoVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ active: 0, total: 0 })
  const [showUpload, setShowUpload] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('active')
  const [nicheFilter, setNicheFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
        setAuthLoading(false)
      }).catch(() => { router.push('/dashboard') })
    })
  }, [router])

  const fetchVideos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (nicheFilter) params.set('niche', nicheFilter)
      if (searchQuery) params.set('q', searchQuery)

      const res = await fetch(`/api/admin/video-library?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setVideos(json.data.videos)
        setCounts(json.data.counts)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [statusFilter, nicheFilter, searchQuery])

  useEffect(() => {
    if (authorized) fetchVideos()
  }, [authorized, fetchVideos])

  const handleAction = async (id: string, action: 'pause' | 'activate' | 'archive') => {
    const status = action === 'pause' ? 'paused' : action === 'activate' ? 'active' : 'archived'
    await fetch(`/api/admin/video-library/${id}`, {
      method: action === 'archive' ? 'DELETE' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchVideos()
  }

  if (authLoading) {
    return <div className="flex justify-center py-24"><WolfLoader variant="spinner" size={32} mode="amber" /></div>
  }
  if (!authorized) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Film className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Video Library</h1>
            <p className="text-xs text-zinc-500">{counts.active} active / {counts.total} total promo videos</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Upload Video
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                statusFilter === f.value
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Niche filter */}
        <select
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300"
        >
          <option value="">All niches</option>
          {NICHE_FILTERS.filter(Boolean).map(n => (
            <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="amber" />
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <Film className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No videos found. Upload your first promo video!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              onSelect={(id) => router.push(`/admin/video-library/${id}`)}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onUploaded={fetchVideos}
        />
      )}
    </div>
  )
}
