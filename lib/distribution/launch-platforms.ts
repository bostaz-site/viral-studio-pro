/**
 * Single source of truth for which platforms are active at launch.
 * Import this everywhere instead of hardcoding platform arrays.
 *
 * To enable a new platform: add it here. Client + server both read this.
 */
export type Platform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'x'

export const LAUNCH_ACTIVE_PLATFORMS: Platform[] = ['tiktok']

export function isComingSoonPlatform(p: Platform): boolean {
  return !LAUNCH_ACTIVE_PLATFORMS.includes(p)
}

export function isActivePlatform(p: Platform): boolean {
  return LAUNCH_ACTIVE_PLATFORMS.includes(p)
}
