# Lab Prompt — distribution-hub (cycle #1)

> Auto-generated from Lab deep dive on 2026-06-30

## Target Metric
**enhance_to_publish_rate** — minimum delta: 20

Measurement: COUNT(render_jobs WHERE status='done' AND clip_id IN (SELECT clip_id FROM publish_events WHERE created_at >= render_jobs.updated_at)) / COUNT(render_jobs WHERE status='done') OVER rolling 7d window

## Final Recommendation
When a render job transitions from 'rendering' → 'done', the render completion screen's primary CTA shifts from 'Download' to a prominent 'Publish' button. Clicking it opens a single inline modal (no navigation) with: (1) platform toggles for connected accounts (TikTok, YouTube Shorts, Instagram Reels), each pre-populated with a caption derived from clip title + first 2 sentences of transcript + 5-8 niche hashtags pulled from distribution_settings.default_hashtags OR inferred from trending_clips.niche, (2) a 'Post Now' primary button and a 'Schedule: optimal time' secondary link using distribution_settings.optimal_hours, (3) if no accounts connected, the modal shows an inline OAuth popup (popupWindow, not full redirect) — user completes auth without leaving the page. 'Download only' remains accessible as a text link below the publish CTA, not a button. The modal is dismissible and re-openable from the clip card's kebab menu for 24h post-render.

Implementation is additive: render_jobs table already has clip_id and status. When status='done', the frontend polling/realtime subscription triggers the modal. The modal reads distribution_settings (already exists per CLAUDE.md) for hashtags and optimal_hours. Caption generation is a simple string concat — no AI call needed at this stage.

The 'one-click to TikTok from the enhance page' pattern directly attacks the enhance_to_publish_rate drop-off: users are at peak motivation the moment they see their enhanced clip, and every extra navigation step bleeds that motivation.

## Rationale
Opus's timing insight (render completion = peak motivation) beats Sonnet's 'exit editor' trigger because the user hasn't seen the final clip yet when they click Export — the render takes time. Catching them at the 'your clip is ready' moment is the correct emotional beat. Sonnet contributed the inline OAuth pattern (not redirect) which is critical to not breaking the flow. The raw intuition (per-platform format optimization) is already solved: the VPS renders 9:16 vertical natively, so TikTok/Reels/Shorts format is identical — no re-export needed. The real friction is the navigation gap post-render, which both councils correctly identified.

## Kill Switch — MUST ADDRESS (severity 7/10)
This solution assumes users are completing renders inside the app and waiting for results. If the majority of users close the tab after clicking Export and return later (async workflow), the modal never fires at peak motivation — they land on a static 'done' clip card with no publish prompt visible. Additionally, if TikTok/Instagram API scopes change or get restricted (Meta/TikTok developer policy shifts are frequent), the inline OAuth becomes a dead end and the entire publish path breaks. Finally, if render jobs frequently fail or take >5 minutes, users stop waiting and the peak-motivation window collapses entirely — they're no longer emotionally invested when they return.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Separate 'Distribution Hub' tab in the dashboard for managing all publish schedules: Adds navigation steps between editing and publishing — exactly the drop-off pattern we're trying to eliminate. Peak motivation is at render completion, not 2 clicks later in a separate tab.
- Per-platform re-export: separate render jobs for TikTok (9:16), YouTube Shorts (9:16 with thumbnail crop), Instagram Reels (caption truncation at 2200 chars): The VPS already renders 9:16 universally. Re-rendering per platform adds Railway cost, render queue pressure, and user wait time for a problem that doesn't exist. Caption truncation is a trivial client-side string op, not a render concern.
- Trigger the publish modal on 'Done' click in the enhance editor (pre-render): User hasn't seen the final clip yet. The emotional peak is post-preview, not pre-render. Sonnet's timing misses the motivational window that Opus correctly identifies.

## Effort
~2.8h with Claude Code (14h human estimate)

## Confidence: 8/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(distribution-hub): lab cycle 1`
- [ ] Push to origin
