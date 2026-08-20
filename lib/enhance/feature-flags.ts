/**
 * Features frozen behind "Coming Soon" for launch.
 * To re-enable: remove the key from this array.
 * All UI, scoring, AI optimize, and render routes read this constant.
 *
 * 2026-08: smartZoom + hook text unfrozen. hookReorder stays disabled by design
 * (cuts mid-word) but is no longer in this array — it's hardcoded off in the
 * enhance page and render route instead.
 */
export const COMING_SOON_FEATURES = [] as const

export type ComingSoonFeature = (typeof COMING_SOON_FEATURES)[number]

export function isComingSoon(feature: string): boolean {
  return (COMING_SOON_FEATURES as readonly string[]).includes(feature)
}
