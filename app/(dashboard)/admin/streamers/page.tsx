"use client"

import { useEffect, useState, useCallback } from 'react'
import {
  Users, Plus, RefreshCw, Loader2, ToggleLeft, ToggleRight, Trash2,
  Radio, Zap, Clock, BarChart3, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Streamer {
  id: string
  display_name: string
  twitch_login: string | null
  kick_login: string | null
  twitch_id: string | null
  kick_slug: string | null
  niche: string | null
  priority: number | null
  active: boolean | null
  avg_clip_views: number | null
  avg_clip_velocity: number | null
  total_clips_tracked: number | null
  last_fetched_at: string | null
  fetch_interval_minutes: number | null
  created_at: string | null
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AdminStreamersPage() {
  const [streamers, setStreamers] = useState<Streamer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTwitch, setNewTwitch] = useState('')
  const [newKick, setNewKick] = useState('')
  const [newPriority, setNewPriority] = useState(5)
  const [saving, setSaving] = useState(false)
  const [fetchingId, setFetchingId] = useState<string | null>(null)

  const fetchStreamers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/streamers')
      const json = await res.json()
      if (json.data) setStreamers(json.data)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchStreamers() }, [fetchStreamers])

  const handleAdd = async () => {
    if (!newName) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newName,
          twitch_login: newTwitch || undefined,
          kick_login: newKick || undefined,
          priority: newPriority,
        }),
      })
      if (res.ok) {
        setNewName(''); setNewTwitch(''); setNewKick(''); setNewPriority(5); setShowAdd(false)
        fetchStreamers()
      }
    } catch { /* silent */ }
    setSaving(false)
  }

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/admin/streamers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    setStreamers(s => s.map(st => st.id === id ? { ...st, active: !active } : st))
  }

  const deleteStreamer = async (id: string) => {
    await fetch(`/api/admin/streamers/${id}`, { method: 'DELETE' })
    setStreamers(s => s.filter(st => st.id !== id))
  }

  const triggerFetch = async (id: string) => {
    setFetchingId(id)
    try {
      await fetch(`/api/admin/streamers/${id}/fetch`, { method: 'POST' })
      fetchStreamers()
    } catch { /* silent */ }
    setFetchingId(null)
  }

  const activeCount = streamers.filter(s => s.active).length
  const totalClips = streamers.reduce((sum, s) => sum + (s.total_clips_tracked ?? 0), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Manage Streamers
          </h1>
          <p className="text-muted-foreground mt-1">Manage the streamer list for clip tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStreamers} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Streamer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Streamers</p>
            <p className="text-2xl font-bold">{streamers.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Clips</p>
            <p className="text-2xl font-bold">{totalClips}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground">{streamers.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold">Add New Streamer</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Display Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="KaiCenat" className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority (0-10)</Label>
                <Input type="number" min={0} max={10} value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value) || 5)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Twitch Login</Label>
                <Input value={newTwitch} onChange={e => setNewTwitch(e.target.value)} placeholder="kaicenat" className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kick Login</Label>
                <Input value={newKick} onChange={e => setNewKick(e.target.value)} placeholder="neon" className="h-8" />
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={saving || !newName}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Streamer list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {streamers.map(s => (
            <Card key={s.id} className={cn('border-border', !s.active && 'opacity-50')}>
              <CardContent className="p-4 flex items-center gap-4">
                {/* Name + platforms */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{s.display_name}</p>
                    <Badge variant="outline" className="text-[10px]">P{s.priority ?? 0}</Badge>
                    {s.twitch_login && (
                      <Badge className="text-[10px] bg-purple-500/15 text-purple-400">Twitch: {s.twitch_login}</Badge>
                    )}
                    {s.kick_login && (
                      <Badge className="text-[10px] bg-green-500/15 text-green-400">Kick: {s.kick_login}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {s.total_clips_tracked ?? 0} clips
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      avg {Math.round(s.avg_clip_views ?? 0)} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(s.last_fetched_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => triggerFetch(s.id)}
                    disabled={fetchingId === s.id}
                    title="Fetch now"
                  >
                    {fetchingId === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleActive(s.id, s.active ?? true)}
                    title={s.active ? 'Deactivate' : 'Activate'}
                  >
                    {s.active ? (
                      <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => deleteStreamer(s.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
