# Lab Prompt — analytics (cycle #1)

> Auto-generated from Lab deep dive on 2026-07-19

## Target Metric
**d7_repeat_publish_rate** — minimum delta: 10

Measurement: SELECT COUNT(DISTINCT a.user_id) FILTER (WHERE b.published_at <= a.published_at + INTERVAL '7 days') * 100.0 / COUNT(DISTINCT a.user_id) FROM (SELECT user_id, MIN(published_at) AS published_at FROM published_posts GROUP BY user_id) a LEFT JOIN published_posts b ON b.user_id = a.user_id AND b.id != (SELECT id FROM published_posts WHERE user_id = a.user_id ORDER BY published_at ASC LIMIT 1)

## Final Recommendation
Ship a two-part intervention targeting the two biggest structural blockers to d7_repeat_publish_rate. Part 1: Replace the diversity-weighted Viral Score with a 'Publish Momentum' streak widget. The current score is architecturally broken at low publication counts — it caps at ~27/100 when only TikTok is connected because diversity alone is worth 45 points. This is a structural demotivator that signals 'you are failing' to every new user. The new widget shows clips-this-week vs. clips-last-week with a comparison sparkline, a score that visibly increases only by publishing again, and always-visible copy showing the exact delta: 'Post 1 more clip this week → +10 pts'. Add Sonnet's decay alert as a sub-component: show two score states side-by-side ('Current: 65 / If you don't post this week: 25 — Getting Started') plus a countdown ('X days left to maintain streak') with a hard CTA that deep-links to the Enhance editor with their most recent clip pre-loaded, or to the top-scored trending clip in their last-published niche if no in-progress clips exist.

Part 2: Ship the First Results Loop. 24-48h after a user's first TikTok publish, trigger an in-app notification card pinned to the top of /dashboard/analytics (and optional email) showing real performance pulled from the existing refresh-post-stats cron + publications table. Frame it as a benchmark ('Your clip ranked better than X% of first clips on Viral Animal in [niche]') — this is the cohort comparison the intuition proposed, but placed at exactly the right moment (post-publish anxiety window) rather than as a passive dashboard. Pair it with ONE prescriptive CTA: 'Your next clip is ready — post [today] at [best time]' deep-linking to the top velocity_score clip in their niche from trending_clips. Both parts share the same behavioral logic: close the feedback loop immediately, always show the next action, never let the user hit a dead end.

## Rationale
Both councils independently identified the Viral Score as a structural demotivator — this is the highest-conviction signal in the synthesis. Sonnet solved the 'decay alert' tactical problem, Opus solved the 'n=1 state' structural problem, and the intuition identified the 'benchmark framing' that makes results meaningful. The final recommendation stacks all three rather than choosing one: fix the broken score (Opus), add the decay mechanic (Sonnet), close the feedback loop with benchmarked first results (intuition, refined). The existing infrastructure makes this unusually low-risk: trending_clips.velocity_score and feed_category already exist, refresh-post-stats cron and publications table already exist, the settings Viral Score component is already isolated. This is primarily a display-layer + trigger-logic change, not a data pipeline change.

## Kill Switch — MUST ADDRESS (severity 7/10)
The streak mechanic backfires if the median new user doesn't publish their first clip within the first week — the widget shows '0 clips this week / 0 last week' with a decay alert on a score they haven't even earned yet, creating anxiety rather than motivation. If onboarding data shows median time-to-first-publish > 7 days, the entire streak frame is wrong and the fix is gating the widget behind first publication. Secondary: the First Results Loop relies on TikTok returning view/like data within 24-48h; if the API latency or cron timing means the card shows 0 views at the retention-critical moment, it's worse than showing nothing — it signals the tool broke. The refresh-post-stats cron must be confirmed to run at least every 6h and TikTok must return non-zero data before the card is shown (add a guard: only show if views > 0).

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Cohort benchmark dashboard (standalone analytics page showing views/clip vs. niche average): Passive data viewing. Research consensus and both councils agree that dashboards don't drive behavioral change — users must encounter the benchmark at the moment of maximum motivational leverage (post-first-publish anxiety window), not when they navigate to analytics. A standalone page gets ignored by users who have already churned.
- Patch the Viral Score formula to reduce diversity weighting (e.g., 15 pts instead of 45): Technical fix without behavioral mechanic. Adjusting weights still produces a metric that doesn't tell the user what to DO. The Publish Momentum frame is superior because the user can directly observe the score moving as a result of publishing — the causal link is transparent and action-driving, not just less penalizing.
- Full analytics page redesign with comparative charts: Effort/impact ratio is poor. A full redesign risks breaking existing power-user workflows, takes 8-16h, and the core retention problem is about the 0-to-1 publish journey, not chart sophistication. The targeted widget + First Results Loop addresses the exact churn window (d1-d7) with 3-5h of effort.

## Effort
~1h with Claude Code (5h human estimate)

## Confidence: 8/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(analytics): lab cycle 1`
- [ ] Push to origin
