/**
 * Human-readable formatting for platform lists in UI copy.
 */

const DISPLAY_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
}

/**
 * Format a list of platform IDs into a human-readable string.
 *
 *   ['tiktok']                    → 'TikTok'
 *   ['tiktok', 'youtube']         → 'TikTok & YouTube'
 *   ['tiktok', 'youtube', 'instagram'] → 'TikTok, YouTube & Instagram'
 *   []                            → fallback (default 'no platform')
 */
export function formatPlatformList(
  platformIds: string[],
  fallback = 'no platform',
): string {
  const names = platformIds.map(id => DISPLAY_NAMES[id] ?? id)
  if (names.length === 0) return fallback
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
