# Lab Prompt — browse-clips (cycle #1)

> Auto-generated from Lab deep dive on 2026-07-01

## Target Metric
**browse_to_enhance_rate** — minimum delta: 10

Measurement: COUNT(DISTINCT session_id WHERE enhance_clicked=true AND entry_source='browse') / COUNT(DISTINCT session_id WHERE page_visited='browse') over 7-day rolling window — tracked via a single analytics event `clip_enhance_started { source: 'browse' }` fired when user clicks Enhance from the browse grid

## Final Recommendation
Implement hover-triggered muted autoplay preview on TrendingCard with pre-resolved video URLs via IntersectionObserver + batch API call on scroll-into-view. This eliminates the per-hover latency (~0ms vs current 300-800ms) so the preview starts instantly on mouse-enter — the single most important factor for conversion on browse surfaces. After 1.5 seconds of playback, fade in a floating overlay CTA anchored to the bottom-center of the video element (not below the card) with: the clip's viral score badge, the dynamic verdict one-liner from feed_category ('Exploding — catch it now' / 'Early Gem'), and a single large 'Enhance This Clip →' button with high contrast.

On mobile, a first tap triggers the preview+CTA state (no navigation). A second tap on the CTA navigates to /enhance. On desktop, clicking anywhere on the playing video while the overlay is visible navigates to /enhance — the entire card becomes the click target once the user has shown intent by hovering 1.5s+.

Implementation order matters: ship the IntersectionObserver pre-resolution first (pure perf win, zero UI risk), then add the overlay CTA. Rollout with a feature flag so you can A/B against the current card behavior and measure browse_to_enhance_rate directly.

## Rationale
The intuition (add a button to the card) is correct in direction but wrong in execution — a static button below the thumbnail has low visual salience and fires before intent is established. The council converges on intercepting at the moment of maximum intent: after the user has watched 1.5s of a clip they chose to hover over, they have self-selected as interested. The Opus optimization (pre-resolved URLs) is the highest-leverage non-obvious addition that raw intuition missed entirely — 300-800ms preview latency is a conversion killer on browse surfaces regardless of how good the CTA copy is. The CTA-on-video positioning (Opus) beats CTA-below-card (Sonnet) because it doesn't require the user to shift eye focus away from the playing content. Combining both council outputs gives the full solution: instant preview (Opus infra) + on-video CTA (Opus UX) + mobile tap handling (Sonnet UX).

## Kill Switch — MUST ADDRESS (severity 8/10)
The clips in trending_clips are Twitch clips stored as external_url pointing to Twitch's CDN. If Twitch CDN URLs require auth tokens or have CORS restrictions that block cross-origin video playback in the browser, the entire hover preview mechanism fails silently — users see a blank video element and the CTA never appears. Twitch clip URLs are time-limited tokens in some configurations. Additionally, if the batch pre-resolution API call happens on every scroll event and the user is on a slow connection or the backend is slow, you're adding N API calls per scroll that could degrade browse performance more than the preview helps conversion. A third failure mode: if >60% of browse traffic is mobile (check analytics before building), the desktop-first hover UX is the wrong primary interaction model entirely.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Static 'Boost This Clip' button added directly to each TrendingCard (original intuition): Fires before intent is established, low visual salience competing with thumbnail and metadata, no preview means users click blind and bounce back — increases clicks but not enhance completions. Doesn't address the discovery-to-action gap, just moves the button closer.
- CTA overlay slides in after hover but without video preview playing (Sonnet partial): The overlay appearing without the video playing removes the intent signal — you're showing a CTA to someone who may have hovered accidentally. The video preview is what creates the 1.5s attention lock that makes the CTA convert. Without the preview, it's just a tooltip with a button.
- Full modal/drawer that opens on card click with preview + CTA inside: Adds a navigation step and breaks browse flow. Users in browse mode are scanning, not committing. The hover-in-place pattern respects the scan behavior and upgrades the micro-moment without forcing a context switch.

## Effort
~2.4h with Claude Code (12h human estimate)

## Confidence: 7/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(browse-clips): lab cycle 1`
- [ ] Push to origin
