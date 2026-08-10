/**
 * Features frozen behind "Coming Soon" for launch.
 * To re-enable: remove the key from this array.
 * All UI, scoring, AI optimize, and render routes read this constant.
 */
export const COMING_SOON_FEATURES = ['hookReorder', 'smartZoom'] as const

export type ComingSoonFeature = (typeof COMING_SOON_FEATURES)[number]

export function isComingSoon(feature: string): boolean {
  return (COMING_SOON_FEATURES as readonly string[]).includes(feature)
}
