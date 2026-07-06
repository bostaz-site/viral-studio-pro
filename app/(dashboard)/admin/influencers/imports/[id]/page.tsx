'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
// Auth check only - data fetched via API
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ImportBatch {
  id: string
  imported_by: string
  source: string
  file_name: string | null
  rows_total: number
  rows_imported: number
  rows_skipped_duplicate: number
  rows_skipped_suppression: number
  rows_failed: number
  errors: { row: number; message: string }[]
  status: string
  started_at: string
  completed_at: string | null
  metadata: Record<string, unknown>
}

export default function BatchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const batchId = params.id as string

  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const [loading, setLoading] = useState(true)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setAuthLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  // Fetch batch via API
  useEffect(() => {
    if (!authorized || !batchId) return
    fetch(`/api/admin/influencers/import/batches?id=${batchId}`)
      .then(r => r.json())
      .then(json => {
        if (!json.data) {
          router.push('/dashboard/admin/influencers/imports')
          return
        }
        setBatch(json.data as ImportBatch)
        setLoading(false)
      })
      .catch(() => router.push('/dashboard/admin/influencers/imports'))
  }, [authorized, batchId, router])

  if (authLoading || !authorized || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <WolfLoader variant="spinner" size={24} mode="amber" />
      </div>
    )
  }

  if (!batch) return null

  const statusIcon = batch.status === 'completed' ? (
    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
  ) : batch.status === 'partial' ? (
    <AlertTriangle className="h-6 w-6 text-yellow-400" />
  ) : batch.status === 'failed' ? (
    <XCircle className="h-6 w-6 text-destructive" />
  ) : (
    <WolfLoader variant="spinner" size={24} mode="amber" />
  )

  const duration = batch.completed_at
    ? Math.round((new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime()) / 1000)
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/influencers/imports">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {batch.file_name ?? 'Import Batch'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date(batch.started_at).toLocaleString()}
              {duration !== null && ` · ${duration}s`}
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Rows" value={batch.rows_total} />
        <StatCard label="Imported" value={batch.rows_imported} color="text-emerald-400" />
        <StatCard label="Duplicates" value={batch.rows_skipped_duplicate} color="text-yellow-400" />
        <StatCard label="Suppressed" value={batch.rows_skipped_suppression} color="text-orange-400" />
        <StatCard label="Failed" value={batch.rows_failed} color="text-destructive" />
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Batch ID</dt>
              <dd className="font-mono text-xs mt-0.5">{batch.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="mt-0.5">{batch.source}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <Badge variant={
                  batch.status === 'completed' ? 'default' :
                  batch.status === 'partial' ? 'secondary' :
                  batch.status === 'failed' ? 'destructive' : 'outline'
                }>
                  {batch.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="mt-0.5">{new Date(batch.started_at).toLocaleString()}</dd>
            </div>
            {batch.completed_at && (
              <div>
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="mt-0.5">{new Date(batch.completed_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Errors */}
      {batch.errors && batch.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              Errors ({batch.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-destructive/20 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-destructive/5 border-b border-destructive/20">
                    <th className="text-left px-3 py-2 font-medium">Row</th>
                    <th className="text-left px-3 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.errors.map((err, i) => (
                    <tr key={i} className="border-b border-destructive/10 last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">{err.row}</td>
                      <td className="px-3 py-1.5 text-destructive/80">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/influencers/import">
          <Button variant="outline">New Import</Button>
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="text-center py-3">
        <p className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
