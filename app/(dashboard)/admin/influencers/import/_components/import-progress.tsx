'use client'

import { Loader2 } from 'lucide-react'

interface ImportBatchStatus {
  rows_total: number
  rows_imported: number
  rows_skipped_duplicate: number
  rows_skipped_suppression: number
  rows_failed: number
  status: string
}

interface ImportProgressProps {
  batch: ImportBatchStatus | null
  isPolling: boolean
}

export function ImportProgress({ batch, isPolling }: ImportProgressProps) {
  if (!batch) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Starting import...</span>
      </div>
    )
  }

  const processed = batch.rows_imported + batch.rows_skipped_duplicate + batch.rows_skipped_suppression + batch.rows_failed
  const pct = batch.rows_total > 0 ? Math.round((processed / batch.rows_total) * 100) : 0
  const isComplete = batch.status !== 'processing'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isComplete && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <span className="text-sm font-medium">
            {isComplete ? 'Import complete' : 'Importing...'}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CounterCard label="Imported" value={batch.rows_imported} color="text-emerald-400" />
        <CounterCard label="Duplicates" value={batch.rows_skipped_duplicate} color="text-yellow-400" />
        <CounterCard label="Suppressed" value={batch.rows_skipped_suppression} color="text-orange-400" />
        <CounterCard label="Failed" value={batch.rows_failed} color="text-destructive" />
      </div>

      <p className="text-xs text-muted-foreground">
        {processed} / {batch.rows_total} rows processed
      </p>
    </div>
  )
}

function CounterCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
