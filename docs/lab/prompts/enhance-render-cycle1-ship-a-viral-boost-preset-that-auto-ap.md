# Lab Prompt — enhance-render (cycle #1)

> Auto-generated from Lab deep dive on 2026-07-01

## Target Metric
**enhance_to_export_completion_rate** — minimum delta: 15

Measurement: COUNT(render_jobs WHERE status='done' AND created_at >= session_start) / COUNT(render_jobs WHERE status IN ('done','error','pending') AND created_at >= session_start) over a 7-day rolling window, segmented by users who entered the enhance editor

## Final Recommendation
Ship a 'Viral Boost' preset that auto-applies on enhance page load: captions ON (Hormozi style, font 78, highlight animation), 9:16 format, streamer tag ON — so the page opens render-ready with zero configuration required. Pair this with a client-side live preview: the source clip's URL plays in a native <video> element inside a 9:16 CSS-framed container using object-fit/object-position to simulate the crop, with CSS-positioned <span> overlays mimicking the caption template in sync with video currentTime (via requestAnimationFrame or timeupdate events). Every setting change — caption style, split-screen toggle, aspect ratio — triggers a DOM update under 200ms with no server round-trip. The primary CTA 'Export Now' sits above the fold, always visible. All granular controls (custom font size, manual reorder, watermark) collapse into an 'Advanced' accordion below. The user's cognitive job shrinks from 'configure and hope' to 'glance and approve.'

Add a render progress modal with labeled FFmpeg stages (Downloading → Applying captions → Compositing → Uploading) and a browser Notification API permission request on first export — so users who background the tab after clicking Export still get pinged when the clip is ready. This directly attacks the abandonment that happens in the render-wait dead zone. The notification requires one-time browser permission consent; show it as a small opt-in inside the progress modal ('Notify me when done →') rather than a premature permission prompt on page load.

Implementation order: (1) auto-preset on page load — 2h, pure frontend state init; (2) 9:16 CSS preview frame with video element — 4h; (3) caption overlay rendering via DOM spans synced to playback — 8h; (4) settings → preview reactivity wiring — 4h; (5) render progress modal with stage labels — 4h; (6) Notification API integration — 2h. Total ~24h. Ship steps 1-4 as a single PR, steps 5-6 as a follow-up.

## Rationale
Both councils converged hard on the same two primitives (auto-preset + CSS preview), which is a strong signal these are load-bearing. The Sonnet council's UX reframe ('approve and export' not 'configure and hope') is the correct mental model and should drive layout decisions. Opus adds the technically important details: <200ms reactivity constraint, Notification API for tab-backgrounding abandonment. The accordion pattern for advanced controls is the right trade-off — it doesn't remove power-user options but removes them from the critical path. The render notification directly addresses the second abandonment cliff (post-click wait), which the intuition missed entirely.

## Kill Switch — MUST ADDRESS (severity 8/10)
Supabase Storage clips are served behind signed URLs or require auth headers, making the <video> src unplayable cross-origin in the browser without additional fetch+blob workaround. If trending_clips use external Twitch CDN URLs that expire in minutes, the preview video element will 404 by the time the user lands on the enhance page. Either scenario makes the entire live preview non-functional, reverting the UX to exactly the status quo while shipping dead preview UI. Secondary kill switch: if the caption overlay timing drifts significantly from FFmpeg's actual output (different font metrics, line-break algorithm, timing offsets), users approve a preview that looks nothing like the rendered output — destroying trust faster than the blank config form ever did.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Server-side preview render (low-res FFmpeg thumbnail strip showing captioned frames): Introduces server round-trip latency (5-15s) on every setting change, recreating the exact 'render and wait' friction we're trying to eliminate. Costs Railway compute on abandoned sessions. Only justified if CSS fidelity gap vs FFmpeg output is unacceptable, which should be evaluated after shipping the CSS version.
- Canvas-only rendering for captions (no DOM spans, all drawn via Canvas 2D API): Canvas text rendering is significantly more complex (manual font metrics, line-break, highlight rect math) than CSS-positioned spans, adds ~12h of engineering, and produces no better fidelity for the user. DOM spans with CSS styling get the job done and are trivially reactive to state changes via React re-renders.
- Skip preview entirely — just improve the render speed on Railway so the wait is <10s: Even 10s render latency with no preview means users click Export blind. Faster render doesn't fix the 'I don't know what I'm getting' anxiety that prevents the Export click in the first place. Speed optimization is orthogonal and should be pursued separately, not as a substitute for preview.

## Effort
~4.8h with Claude Code (24h human estimate)

## Confidence: 8/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(enhance-render): lab cycle 1`
- [ ] Push to origin
