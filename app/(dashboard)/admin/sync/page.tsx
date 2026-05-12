'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, Mail, Megaphone, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SyncStatusCard } from './_components/sync-status-card'

interface SyncStats {
  total_mailboxes: number
  active_mailboxes: number
  avg_reputation_score: number | null
  total_campaigns: number
  running_campaigns: number
}

interface SyncError {
  entity: string
  id: string
  name: string
  error: string
}

interface SyncResult {
  success: boolean
  started_at: string
  completed_at: string
  mailboxes_synced: number
  campaigns_synced: number
  errors: SyncError[]
}

interface SyncData {
  is_syncing: boolean
  last_sync_at: string | null
  last_sync_result: SyncResult | null
  next_sync_at: string | null
  stats: SyncStats
}

export default function SyncPage() {
  const [data, setData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync/instantly')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const handleForceSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/sync/instantly', { method: 'POST' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Refresh status after sync
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instantly Sync</h1>
          <p className="text-muted-foreground">
            Mailbox health & campaign metrics from Instantly
          </p>
        </div>
        <Button onClick={handleForceSync} disabled={syncing || data?.is_syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Force Sync Now'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Sync Status Card */}
      <SyncStatusCard
        lastSyncAt={data?.last_sync_at ?? null}
        nextSyncAt={data?.next_sync_at ?? null}
        isSyncing={data?.is_syncing ?? false}
        success={data?.last_sync_result?.success ?? null}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mailboxes
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.total_mailboxes ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.stats.active_mailboxes ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Reputation
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.stats.avg_reputation_score ?? '--'}
              {data?.stats.avg_reputation_score != null && (
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {getReputationLabel(data?.stats.avg_reputation_score ?? null)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campaigns
            </CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.stats.total_campaigns ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.stats.running_campaigns ?? 0} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Sync
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.last_sync_result
                ? `${data.last_sync_result.mailboxes_synced + data.last_sync_result.campaigns_synced}`
                : '--'}
            </div>
            <p className="text-xs text-muted-foreground">items synced</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sync Errors */}
      {data?.last_sync_result?.errors && data.last_sync_result.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Sync Errors ({data.last_sync_result.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.last_sync_result.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm p-2 rounded bg-muted/50"
                >
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {err.entity}
                  </span>
                  <span className="font-medium">{err.name}</span>
                  <span className="text-muted-foreground flex-1">{err.error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Sync Summary */}
      {data?.last_sync_result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {data.last_sync_result.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-yellow-500" />
              )}
              Last Sync Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Started</div>
                <div>{formatTime(data.last_sync_result.started_at)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Completed</div>
                <div>{formatTime(data.last_sync_result.completed_at)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Mailboxes Synced</div>
                <div className="font-medium">{data.last_sync_result.mailboxes_synced}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Campaigns Synced</div>
                <div className="font-medium">{data.last_sync_result.campaigns_synced}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getReputationLabel(score: number | null): string {
  if (score === null) return 'No data'
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor - action needed'
}
