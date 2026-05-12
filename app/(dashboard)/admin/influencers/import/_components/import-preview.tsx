'use client'

import type { InfluencerCSVRow } from '@/lib/admin/csv-parser'

interface ImportPreviewProps {
  validRows: InfluencerCSVRow[]
  validationErrors: { row: number; message: string }[]
  totalParsed: number
}

export function ImportPreview({ validRows, validationErrors, totalParsed }: ImportPreviewProps) {
  const displayRows = validRows.slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
            {validRows.length} valid
          </span>
          {validationErrors.length > 0 && (
            <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              {validationErrors.length} invalid
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            of {totalParsed} rows parsed
          </span>
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Platform</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Handle</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Audience</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Niche</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tags</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono">{row.email}</td>
                <td className="px-3 py-1.5">{[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}</td>
                <td className="px-3 py-1.5">{row.primary_platform || '-'}</td>
                <td className="px-3 py-1.5">{row.platform_handle || '-'}</td>
                <td className="px-3 py-1.5">{row.audience_size?.toLocaleString() ?? '-'}</td>
                <td className="px-3 py-1.5">{row.niche || '-'}</td>
                <td className="px-3 py-1.5">{row.tags || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {validRows.length > 10 && (
          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
            Showing 10 of {validRows.length} rows
          </div>
        )}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive mb-2">
            Validation errors ({validationErrors.length}):
          </p>
          <ul className="space-y-1">
            {validationErrors.slice(0, 10).map((err, i) => (
              <li key={i} className="text-xs text-destructive/80">
                Row {err.row}: {err.message}
              </li>
            ))}
            {validationErrors.length > 10 && (
              <li className="text-xs text-destructive/60">
                ...and {validationErrors.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
