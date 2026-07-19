# Lab Notes — analytics


---

## Cycle #1 — 2026-07-02

Ship a two-part intervention targeting the two biggest structural blockers to d7_repeat_publish_rate. Part 1: Replace the diversity-weighted Viral Score with a 'Publish Momentum' streak widget. The current score is architecturally broken at low publication counts — it caps at ~27/100 when only TikTok is connected because diversity alone is worth 45 points. This is a structural demotivator that signals 'you are failing' to every new user. The new widget shows clips-this-week vs. clips-last-week w

**Confidence**: 8/10 | **Effort**: 5h
**Kill switch**: The streak mechanic backfires if the median new user doesn't publish their first clip within the first week — the widget shows '0 clips this week / 0 last week' with a decay alert on a score they haven't even earned yet, creating anxiety rather than motivation. If onboarding data shows median time-to-first-publish > 7 days, the entire streak frame is wrong and the fix is gating the widget behind first publication. Secondary: the First Results Loop relies on TikTok returning view/like data within 24-48h; if the API latency or cron timing means the card shows 0 views at the retention-critical moment, it's worse than showing nothing — it signals the tool broke. The refresh-post-stats cron must be confirmed to run at least every 6h and TikTok must return non-zero data before the card is shown (add a guard: only show if views > 0).
[Full deep dive](../cycles/2026-07-02-cycle1/analytics.md)


---

## Cycle #2 — 2026-07-03

Add a 'Next Move' action card pinned at the top of the analytics dashboard — a single module that converts the page from passive report to publishing decision. The card shows three things in one compact row: (1) a projected Viral Score delta ('Post today: 40 → 65') framed as gain, (2) a loss-aversion sub-line when Regularity is at risk ('Regularity drops in 2 days if you skip today' — computable since Regularity = min(thisWeekPubs*10, 40)), and (3) a smart CTA that adapts based on state: if the 

**Confidence**: 7/10 | **Effort**: 2.5h
**Kill switch**: The feature has zero impact if analytics page visits are a small fraction of DAU. If users flow browse → enhance → publish without ever visiting analytics, the card gets no impressions and the target metric is irrelevant. A secondary failure: new users with 0 published posts see a card about 'Regularity dropping' when they have no Regularity score yet — the loss-aversion framing is hollow and potentially confusing. Third: if pendingClipId detection is wrong (e.g., a clip was published outside the app or the render_jobs query has a race condition), the CTA fires on a clip the user already posted — wasted click and broken UX.
[Full deep dive](../cycles/2026-07-03-cycle2/analytics.md)


---

## Cycle #2 — 2026-07-03

Ship a 'Your #1 Move This Week' insight card at the top of the analytics dashboard — a single prescription derived from existing data, no AI required for v1. The card reads the user's lowest-performing Viral Score component and emits one plain-English action + CTA button that deep-links into the scheduling flow. Three rule variants: regularity below 20 → 'Post 3 more clips this week' → [Schedule a Clip]; volume below 8 → 'You have X clips in your bank — publish one now' → [Open Clip Bank]; diver

**Confidence**: 7/10 | **Effort**: 2.5h
**Kill switch**: The analytics dashboard is visited by fewer than 20% of users who publish a clip — they publish, close the tab, and never return. If analytics is not a natural stop in the post-publish flow, the insight card is never seen regardless of quality. This is likely the real activation bottleneck: not the absence of an insight, but the absence of a reason to visit analytics at all. Secondary kill switch: publication_performance data is sparse because TikTok's API returns view counts with a 24-48h lag, so the card is in cold-start mode for almost every user for the first 2 days post-publish — making 'personalized' insights indistinguishable from generic ones in the critical first-impression window.
[Full deep dive](../cycles/2026-07-03-cycle2/analytics.md)


---

## Cycle #2 — 2026-07-03

Extend the existing `publication_performance` table and `refresh-post-stats` cron to pull real TikTok video metrics (views, likes, shares, comments) using the video_id returned by the Direct Post API at publish time. Schedule 4 automatic fetch windows: 2h, 24h, 72h, 7d post-publish — aggressive early (every 2h for first 48h as Opus suggests), then daily. The TikTok video_id must be captured and stored in `published_posts` at the moment of publish via the existing `UnifiedPublishDialog` → `/api/p

**Confidence**: 7/10 | **Effort**: 5h
**Kill switch**: TikTok's Direct Post API (which we have approved) may not expose per-video analytics. The approved Direct Post API gives a publish_id for upload status checks — but reading video views/likes/shares may require the Video API or Creator Marketplace API, which are separate approval tracks. CLAUDE.md explicitly flags Stage 4 (TikTok Creator Info) as 'bloqué par permissions API'. If the analytics read endpoints require unapproved scopes, the entire feature has no data source and collapses to zero. The fix path (apply for additional TikTok API permissions) is months-long with no guaranteed approval. Before building anything else, we must validate that the approved Direct Post API token can call a video stats endpoint and get non-empty data for a real published video.
[Full deep dive](../cycles/2026-07-03-cycle2/analytics.md)
