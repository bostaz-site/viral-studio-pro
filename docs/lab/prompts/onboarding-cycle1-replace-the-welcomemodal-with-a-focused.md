# Lab Prompt — onboarding (cycle #1)

> Auto-generated from Lab deep dive on 2026-06-30

## Target Metric
**first_render_completion_rate** — minimum delta: 15

Measurement: COUNT(DISTINCT render_jobs.user_id WHERE render_jobs.status = 'done' AND render_jobs.created_at <= profiles.created_at + INTERVAL '24 hours') / COUNT(DISTINCT profiles.id) — computed over a 14-day new-user cohort window, refreshed weekly

## Final Recommendation
Replace the WelcomeModal with a focused 'Make Your First Viral Clip' overlay that appears once for new users on /dashboard. Show 4-5 pre-curated clips from trending_clips (top velocity_score, 15-45s duration, 2-3 diverse niches — FPS, IRL, reaction). Each card shows thumbnail, streamer name, view count, and a single 'Make Viral →' button. No carousel, no explainer slides — the UI IS the explanation. When a user clicks 'Make Viral', immediately trigger a render job with all defaults (karaoke captions on, streamer tag on, 9:16 crop) and navigate to a purpose-built /dashboard/first-clip?job={id} waiting screen. This screen shows render progress (polling every 3s), a minimal 3-bullet 'what's happening' explainer (education is now contextual, not upfront), and the clip thumbnail. Do NOT route through the enhance page — that's a configuration graveyard for first-timers.

When the render completes, auto-play the output full-screen in a modal with two CTAs: 'Download' (primary) and 'Try another clip' (secondary). This collapses the funnel from 5 steps to 2 (pick → watch result) and delivers the aha moment — seeing their clip transformed — within 60-90 seconds of first login. Add a persistent 'Skip — browse library' link in muted text below the clip cards so power users aren't trapped.

Implementation: gate this overlay on a profiles column 'has_completed_first_clip' (boolean, default false). Set it true when the render completes and the user sees the result. Subsequent logins go straight to the normal dashboard.

## Rationale
Sonnet's 'one pre-selected clip' reduces choice but feels presumptuous and still routes through the enhance page (config friction remains). Opus's 'skip enhance page entirely' is the right instinct — the enhance page is a power-user tool, not an onboarding tool. The hybrid (4-5 curated choices + immediate render + dedicated waiting screen) gives enough agency to not feel forced while eliminating every decision that isn't 'pick a clip'. The intuition's 'passive demo' was rejected because watching someone else's result never produces the same dopamine hit as seeing YOUR chosen clip transformed. The council unanimously identifies the enhance page as the friction source — the recommendation acts on that signal.

## Kill Switch — MUST ADDRESS (severity 8/10)
The entire strategy depends on render reliability and speed. If the VPS (Railway) render fails for >20% of first-time renders, or if average render time exceeds 3 minutes, this strategy makes onboarding catastrophically worse — users stare at a spinner, the explainer text feels like a lie, and they churn with a negative first impression rather than just a neutral one. A second failure mode: if the trending_clips table has fewer than 5 clips with duration 15-45s and decent thumbnails (e.g. after a scraper outage), the overlay shows broken or low-quality content and the 'curated' promise collapses. Third failure mode: DMCA takedowns on Twitch clips mean the source URL 404s mid-render, producing a failed first experience.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Intuition: pre-load a 60s demo clip in the enhance editor: Passive — the user watches a demo, not their own clip being transformed. No ownership, no dopamine. The aha moment requires the user to have made a choice and seen that choice result in something shareable.
- Sonnet: show 1 auto-selected clip + 'Make Viral' then route through /dashboard/enhance: Still passes through the enhance page which has 6+ configuration options. Even with defaults pre-filled, the presence of those toggles creates decision paralysis and delays the render start. The enhance page should be post-aha, not pre-aha.
- Keep the WelcomeModal carousel but add a 'Start with this clip' CTA on the last slide: The modal is skipped by ~60% of users before reaching slide 3. Bolting a CTA onto a pattern users are trained to dismiss doesn't fix the underlying funnel — it just adds one more step users won't reach.

## Effort
~3.2h with Claude Code (16h human estimate)

## Confidence: 7/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(onboarding): lab cycle 1`
- [ ] Push to origin
