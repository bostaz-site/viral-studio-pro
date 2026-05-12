'use client'

import { useState } from 'react'
import { Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const REASONS = [
  { value: '', label: 'All Reasons' },
  { value: 'unsubscribe', label: 'Unsubscribe' },
  { value: 'hard_bounce', label: 'Hard Bounce' },
  { value: 'soft_bounce_threshold', label: 'Soft Bounce' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'manual_block', label: 'Manual Block' },
  { value: 'gdpr_request', label: 'GDPR Request' },
  { value: 'fraud_flag', label: 'Fraud Flag' },
]

const REASON_COLORS: Record<string, string> = {
  unsubscribe: 'text-blue-400 border-blue-400/40',
  hard_bounce: 'text-red-400 border-red-400/40',
  soft_bounce_threshold: 'text-orange-400 border-orange-400/40',
  complaint: 'text-rose-400 border-rose-400/40',
  manual_block: 'text-amber-400 border-amber-400/40',
  gdpr_request: 'text-purple-400 border-purple-400/40',
  fraud_flag: 'text-red-500 border-red-500/40',
}

export interface SuppressionEntry {
  id: string
  email: string | null
  email_domain: string | null
  reason: string
  source: string | null
  added_at: string
  added_by: string | null
  metadata: Record<string, unknown>
}

interface SuppressionTableProps {
  entries: SuppressionEntry[]
  total: number
  page: number
  limit: number
  loading: boolean
  onPageChange: (page: number) => void
  onFilterChange: (filters: { reason?: string; search?: string }) => void
  onRemove: (id: string, email: string | null) => void
  currentReason: string
  currentSearch: string
}

export function SuppressionTable({
  entries,
  total,
  page,
  limit,
  loading,
  onPageChange,
  onFilterChange,
  onRemove,
  currentReason,
  currentSearch,
}: SuppressionTableProps) {
  const [search, setSearch] = useState(currentSearch)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / limit)

  const handleSearch = () => {
    onFilterChange({ search: search.trim() || undefined })
  }

  const handleRemove = (id: string, email: string | null) => {
    if (confirmId === id) {
      onRemove(id, email)
      setConfirmId(null)
    } else {
      setConfirmId(id)
      setTimeout(() => setConfirmId(null), 3000)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search email or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 h-8 text-sm"
            />
          </div>

          {/* Reason filter */}
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => onFilterChange({ reason: r.value || undefined })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  currentReason === r.value
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Email / Domain</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Added</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {entry.email ?? `*@${entry.email_domain}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${REASON_COLORS[entry.reason] ?? 'text-muted-foreground'}`}
                      >
                        {entry.reason}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{entry.source ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(entry.added_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 ${confirmId === entry.id ? 'text-red-400 hover:text-red-300' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => handleRemove(entry.id, entry.email)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {confirmId === entry.id ? 'Confirm?' : 'Remove'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {total} entries — Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
