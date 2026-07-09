# Fix: Build Post-Creation Engagement Loop and Retention Infrastructure

## Context
3 findings (109, 110, 144) reveal critical retention gaps: users average 1.5 clips then churn, month cohort retention is 0%, and there's no platform breakdown data to guide product decisions. The core issue is that nothing pulls users back after their first clip — no publish success state, no analytics, no re-engagement triggers, no habit-forming mechanics.

## Task
This is a multi-phase effort. Implement in priority order:

### Phase 1: Post-render engagement hook (highest impact, lowest effort)
1. After a clip finishes rendering, show a success state screen that includes:
   - Clip preview/thumbnail
   - `Publish to TikTok` CTA (primary) — link to existing publish flow or a placeholder
   - `Create Another Clip` CTA (secondary) — pre-loaded with a template based on the clip type just created
   - Share link / download button
   - `Your clip is ready! Creators who post within 1 hour get 3x more views` (or similar urgency copy)
2. Do NOT auto-redirect away from the success state. Let the user choose their next action.

### Phase 2: Platform intent tracking
1. Add a platform-intent selector at clip creation time: `Where will you post this?` with options: TikTok / YouTube Shorts / Instagram Reels / Other.
2. Store the selection in the clips table (new column `target_platform`).
3. Use this to populate `stats.platform_breakdown` for analytics.
4. Use the selection to auto-set export defaults (aspect ratio, caption length limits).

### Phase 3: Re-engagement email triggers
1. Set up a triggered email (via your email provider — Resend, Postmark, etc.) for:
   - **Day 1**: `Your clip is ready to post` — sent if a clip was rendered but not published within 24h. Deep-link to the clip's publish dialog.
   - **Day 7**: `You haven't clipped in a while` — sent to users who rendered a clip 7+ days ago but haven't returned. Include a preview of their last clip and a `Create Your Next Clip` CTA.
   - **Day 30**: `Your clips miss you` — last-chance re-engagement for churning users.
2. Each email should have a single clear CTA deep-linking back into the product.

### Phase 4: Dashboard streak/gamification (optional, lower priority)
1. Add a simple streak counter to the dashboard sidebar: `🔥 3-day streak` based on consecutive days with at least one clip action.
2. Show a weekly clip count in the dashboard hero for returning users.

## Acceptance Criteria
- Phase 1: Post-render screen shows success state with publish + create-another CTAs.
- Phase 2: Platform selector appears at clip creation; data is stored and queryable.
- Phase 3: At least the Day 1 and Day 7 emails are configured and triggered by real events.
- Phase 4 (stretch): Streak counter visible on dashboard.