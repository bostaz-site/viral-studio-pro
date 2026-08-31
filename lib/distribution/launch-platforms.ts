/**
 * Single source of truth for which platforms are active at launch.
 * Import this everywhere instead of hardcoding platform arrays.
 *
 * To enable a new platform: add it here. Client + server both read this.
 *
 * META_PREVIEW_EMAILS: comma-separated list of emails that can access
 * instagram/facebook before they go live (for Meta App Review screencasts).
 *
 * Platform type is defined in platforms.ts — this file re-exports it.
 */
import type { Platform } from './platforms'

export type { Platform }

export const LAUNCH_ACTIVE_PLATFORMS: Platform[] = ['tiktok', 'youtube']

const META_PREVIEW_PLATFORMS: Platform[] = ['instagram', 'facebook']

/**
 * Parse the META_PREVIEW_EMAILS env var into a Set of lowercase emails.
 * Only evaluated once per cold start (server-side).
 */
function getMetaPreviewEmails(): Set<string> {
  const raw = process.env.META_PREVIEW_EMAILS ?? ''
  if (!raw) return new Set()
  return new Set(raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean))
}

export function isComingSoonPlatform(p: Platform, userEmail?: string): boolean {
  if (LAUNCH_ACTIVE_PLATFORMS.includes(p)) return false
  // Meta preview override: if user email is in the allow-list, unlock IG/FB
  if (userEmail && META_PREVIEW_PLATFORMS.includes(p)) {
    const allowed = getMetaPreviewEmails()
    if (allowed.has(userEmail.toLowerCase())) return false
  }
  return true
}

export function isActivePlatform(p: Platform, userEmail?: string): boolean {
  return !isComingSoonPlatform(p, userEmail)
}
