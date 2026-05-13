'use client'

import { useState } from 'react'
import { Download, Check, Mail, ShieldX, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DiscoveryResult {
  id: string
  platform_handle: string | null
  display_name: string | null
  avatar_url: string | null
  audience_size: number | null
  keyword_score: number
  has_email: boolean
  email: string | null
  promoted_products: string[] | null
  import_status: string
  profile_url: string | null
}

interface Props {
  results: DiscoveryResult[]
  onImport: (ids: string[]) => Promise<void>
  importing: boolean
}

export function DiscoveryResultsTable({ results, onImport, importing }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    const importable = results.filter(r => r.import_status === 'pending' && r.has_email)
    if (selected.size === importable.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(importable.map(r => r.id)))
    }
  }

  const handleImport = async () => {
    await onImport(Array.from(selected))
    setSelected(new Set())
  }

  const importable = results.filter(r => r.import_status === 'pending' && r.has_email)

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Results ({results.length})</h3>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-[10px] text-primary hover:underline">
              {selected.size === importable.length ? 'Deselect all' : `Select all with email (${importable.length})`}
            </button>
            {selected.size > 0 && (
              <Button size="sm" className="gap-1 h-7" onClick={handleImport} disabled={importing}>
                <Download className="h-3.5 w-3.5" />
                Import {selected.size} to CRM
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Channel</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Subs</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Score</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Products</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Run a search to see results</td></tr>
              ) : (
                results.map(r => {
                  const canImport = r.import_status === 'pending' && r.has_email
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        {canImport && (
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            className="rounded border-border"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.avatar_url && (
                            <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                          )}
                          <div>
                            <a
                              href={r.profile_url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-foreground hover:text-primary"
                            >
                              {r.display_name ?? r.platform_handle ?? 'Unknown'}
                            </a>
                            {r.platform_handle && (
                              <p className="text-[10px] text-muted-foreground">@{r.platform_handle}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {r.audience_size ? formatNumber(r.audience_size) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-xs font-bold ${
                          r.keyword_score >= 60 ? 'text-green-400' :
                          r.keyword_score >= 30 ? 'text-amber-400' :
                          'text-zinc-500'
                        }`}>
                          {r.keyword_score}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.has_email ? (
                          <Mail className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <ShieldX className="h-3.5 w-3.5 text-zinc-500" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.promoted_products?.length ? (
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3 text-purple-400" />
                            <span className="text-[10px] text-purple-400">{r.promoted_products.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.import_status} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'text-zinc-400' },
    imported: { label: 'Imported', color: 'text-green-400 border-green-400/40' },
    skipped: { label: 'Skipped', color: 'text-amber-400 border-amber-400/40' },
    suppressed: { label: 'Suppressed', color: 'text-red-400 border-red-400/40' },
    duplicate: { label: 'Duplicate', color: 'text-zinc-400' },
  }
  const c = config[status] ?? { label: status, color: 'text-muted-foreground' }
  return <Badge variant="outline" className={`text-[10px] ${c.color}`}>{c.label}</Badge>
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
