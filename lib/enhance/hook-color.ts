/**
 * Hook color mapping — P4 · Hook Hunter (2026-09).
 *
 * Data-backed palette (RECHERCHE-ALGO-VIRALITE-2026, Partie 6): on-screen hook
 * text is white (or black on white sticker) by default; YELLOW signals hype /
 * wholesome energy; RED signals rage / shock / breaking news framing. Other
 * colors are NOT allowed — unknown values map to 'white' (backward compat).
 *
 * Mirrored in vps/lib/hook-generator.js (`getHookColor`) — keep both in sync.
 */

export const HOOK_COLORS = ['white', 'yellow', 'red'] as const
export type HookColor = (typeof HOOK_COLORS)[number]

/** Hex values used by the canvas capture + CSS preview. */
export const HOOK_COLOR_HEX: Record<HookColor, string> = {
  white: '#FFFFFF',
  yellow: '#FFD60A',
  red: '#FF3B30',
}

/** Coerce any stored/legacy value to an allowed hook color. */
export function normalizeHookColor(value: unknown): HookColor {
  return typeof value === 'string' && (HOOK_COLORS as readonly string[]).includes(value)
    ? (value as HookColor)
    : 'white'
}

export interface HookColorInput {
  /** Clip mood (rage, funny, drama, wholesome, hype, story) or any string. */
  mood?: string | null
  /** Hook style picked by the model (shock, curiosity, suspense). */
  hookStyle?: string | null
  /** True when the hook uses a "breaking" framing (early_gem / hot_now, < 6h). */
  breaking?: boolean
  /** Explicit override (validated). */
  override?: unknown
}

/**
 * default → white ; hype | wholesome → yellow ; rage | shock | breaking → red.
 * An explicit valid override wins.
 */
export function getHookColor(input: HookColorInput = {}): HookColor {
  if (input.override !== undefined && input.override !== null && input.override !== '') {
    return normalizeHookColor(input.override)
  }
  const mood = (input.mood ?? '').toLowerCase()
  const style = (input.hookStyle ?? '').toLowerCase()
  if (input.breaking || mood === 'rage' || mood === 'shock' || style === 'shock') return 'red'
  if (mood === 'hype' || mood === 'wholesome') return 'yellow'
  return 'white'
}

/** Whether a feed category / clip age qualifies for "breaking" framing. */
export function isBreakingEligible(feedCategory?: string | null, clipCreatedAt?: string | null): boolean {
  if (feedCategory === 'early_gem' || feedCategory === 'hot_now') return true
  if (clipCreatedAt) {
    const ageH = (Date.now() - new Date(clipCreatedAt).getTime()) / 3_600_000
    if (Number.isFinite(ageH) && ageH >= 0 && ageH < 6) return true
  }
  return false
}
