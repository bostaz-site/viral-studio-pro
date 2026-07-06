'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ImportBatch {
  id: string
  source: string
  file_name: string | null
  rows_total: number
  rows_imported: number
  rows_skipped_duplicate: number
  rows_skipped_suppression: number
  rows_failed: number
  status: string
  started_at: string
  completed_at: string | null
}

export default function ImportsHistoryPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    if (!authorized) return
    fetch('/api/admin/influencers/import/batches')
      .then(r => r.json())
      .then(json => {
        setBatches(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [authorized])

  if (authLoading || !authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <WolfLoader variant="spinner" size={24} mode="amber" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import History</h1>
          <p className="text-sm text-muted-foreground mt-1">All CSV import batches</p>
        </div>
        <Link href="/dashboard/admin/influencers/import">
          <Button className="gap-1.5">
            <Upload className="h-4 w-4" />
            New Import
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="amber" />
        </div>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Clock className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No imports yet</p>
            <Link href="/dashboard/admin/influencers/import">
              <Button variant="outline" size="sm">Import your first CSV</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => (
            <Link key={batch.id} href={`/dashboard/admin/influencers/imports/${batch.id}`}>
              <Card className="hover:ring-primary/30 transition-all cursor-pointer">
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={batch.status} />
                    <div>
                      <p className="text-sm font-medium">
                        {batch.file_name ?? batch.source}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(batch.started_at).toLocaleString()} · {batch.rows_total} rows
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{batch.rows_imported} imported</Badge>
                    {batch.rows_skipped_duplicate > 0 && (
                      <Badge variant="outline">{batch.rows_skipped_duplicate} dupes</Badge>
                    )}
                    {batch.rows_failed > 0 && (
                      <Badge variant="destructive">{batch.rows_failed} failed</Badge>
                    )}
                    <StatusBadge status={batch.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />
    case 'partial':
      return <AlertTriangle className="h-5 w-5 text-yellow-400" />
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />
    default:
      return <WolfLoader variant="spinner" size={20} mode="amber" />
  }
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'default' :
    status === 'partial' ? 'secondary' :
    status === 'failed' ? 'destructive' : 'outline'

  return <Badge variant={variant}>{status}</Badge>
}
