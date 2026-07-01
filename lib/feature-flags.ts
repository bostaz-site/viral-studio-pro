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

/**
 * isHoverPreviewV2: enables hover-triggered muted autoplay with IntersectionObserver
 * pre-resolution and the floating overlay CTA on TrendingCard.
 * Set NEXT_PUBLIC_HOVER_PREVIEW_V2="true" to activate; leave unset for current behavior.
 * Used for A/B testing browse_to_enhance_rate.
 */
export const isHoverPreviewV2 = process.env.NEXT_PUBLIC_HOVER_PREVIEW_V2 === "true"
