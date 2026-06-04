/**
 * Feature flags — controlled via environment variables.
 *
 * AUDIT_MODE: hides streamer-clip-browsing features during TikTok review.
 * Set NEXT_PUBLIC_AUDIT_MODE="true" during audit, "false" or unset for normal operation.
 *
 * This file is safe to import from both client and server components.
 * For the server-only async helper, use `lib/feature-flags.server.ts`.
 */
export const isAuditMode = process.env.NEXT_PUBLIC_AUDIT_MODE === "true"
