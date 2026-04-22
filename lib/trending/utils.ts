/**
 * Shared utility functions for trending clips UI.
 * Deduplicated from trending-card, trending-detail-modal, etc.
 */

/** Format large numbers as compact strings: 1200 → "1K", 1500000 → "1.5M" */
export function formatCount(n: number | null): string {
  if (n === null) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

/** Relative time string: "5m", "3h", "2j" */
export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const ts = new Date(dateStr).getTime()
  if (Number.isNaN(ts)) return ''
  const diff = (Date.now() - ts) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}
