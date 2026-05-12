'use client'

import Link from 'next/link'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImportResultProps {
  result: {
    batchId: string
    status: string
    imported: number
    duplicates: number
    suppressed: number
    failed: number
    errors: { row: number; message: string }[]
  }
  onReset: () => void
}

export function ImportResult({ result, onReset }: ImportResultProps) {
  const icon = result.status === 'completed' ? (
    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
  ) : result.status === 'partial' ? (
    <AlertTriangle className="h-10 w-10 text-yellow-400" />
  ) : (
    <XCircle className="h-10 w-10 text-destructive" />
  )

  const title = result.status === 'completed' ? 'Import Successful' :
    result.status === 'partial' ? 'Import Partial' : 'Import Failed'

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 py-4">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Imported" value={result.imported} variant="success" />
        <SummaryCard label="Duplicates Skipped" value={result.duplicates} variant="warning" />
        <SummaryCard label="Suppressed Skipped" value={result.suppressed} variant="orange" />
        <SummaryCard label="Failed" value={result.failed} variant="error" />
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive mb-2">
            Errors ({result.errors.length}):
          </p>
          <ul className="space-y-1">
            {result.errors.map((err, i) => (
              <li key={i} className="text-xs text-destructive/80">
                Row {err.row}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={onReset} variant="outline">
          Import Another CSV
        </Button>
        <Link href={`/dashboard/admin/influencers/imports/${result.batchId}`}>
          <Button variant="secondary">View Batch Details</Button>
        </Link>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: 'success' | 'warning' | 'orange' | 'error'
}) {
  const colors = {
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    error: 'text-destructive bg-destructive/10 border-destructive/20',
  }

  return (
    <div className={`rounded-lg border p-3 text-center ${colors[variant]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  )
}
