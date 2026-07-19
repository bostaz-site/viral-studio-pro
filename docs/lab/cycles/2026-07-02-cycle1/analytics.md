# Lab Deep Dive — analytics (cycle #1)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a 'views per clip exported' cohort comparison that shows users exactly how their clips perform vs. the platform average by niche. Most users churn because they don't see a clear signal that the tool is working — a benchmark gives them a reason to stay and export more.
- **Risk:** Analytics becomes a vanity dashboard that shows impressions and clicks but never connects back to 'did this clip go viral' — users see numbers, feel nothing, and churn anyway because the data doesn't tell them what to do next.
- **Metric:** clips_exported_to_views_ratio — median TikTok views per exported clip per user, tracked weekly, because it's the only number that proves the product actually works

## Target Metric (forced clarity)
- **Metric:** `d7_repeat_publish_rate`
- **Minimum delta:** 10
- **Measurement:** SELECT COUNT(DISTINCT a.user_id) FILTER (WHERE b.published_at <= a.published_at + INTERVAL '7 days') * 100.0 / COUNT(DISTINCT a.user_id) FROM (SELECT user_id, MIN(published_at) AS published_at FROM published_posts GROUP BY user_id) a LEFT JOIN published_posts b ON b.user_id = a.user_id AND b.id != (SELECT id FROM published_posts WHERE user_id = a.user_id ORDER BY published_at ASC LIMIT 1)
- **Clarity:** 8/10

## Research Synthesis
## User Analytics — Research Synthesis for Viral Animal

---

### 1. Industry Consensus

The field has converged on **funnel-first mental models**: impressions → clicks → watch time → actions, because creators understand where they lose people better than they understand raw counts. Virtually every mature analytics product (YouTube Studio, Spotify for Podcasters, Substack) surfaces a **7-day default view** with trend arrows — consensus is that 24h is too noisy, 30d is too slow, and 7d matches the creator's posting cadence. **Per-asset breakdowns** (per video, per post) are non-negotiable — aggregate metrics alone are useless for iteration. Mobile-readiness is now table stakes; Hootsuite's 2025 creator survey found 74% of creators check stats on mobile within 1h of posting. Retention/completion rate has overtaken raw view count as the primary KPI across TikTok, Reels, and YouTube Shorts.

---

### 2. Industry Disagreement

There is active debate around **prescriptive vs. descriptive analytics** — Chartbeat and some media tools push hard toward "here's what to do next," but practitioners (notably in Creator Economy newsletters like Means of Creation) argue that AI recommendations erode the creator's intuition over time and homogenize content. The **cross-platform aggregation** question is unresolved: tools like Metricool and Later aggregate across platforms, but YouTube and TikTok intentionally wall-garden their data, so cross-platform numbers often mislead (a TikTok view ≠ a YouTube view). There's also disagreement on **what "engagement" means** — TikTok weights shares and rewatches heavily, YouTube weights watch time, and Instagram weights saves; building a single engagement score collapses these into a meaningless average. Finally, real-time counters are debated: Twitter/X and YouTube use them to drive obsessive refresh behavior, but some UX researchers flag this as psychologically harmful and counterproductive for output quality.

---

### 3. Competitor Best Moves

**TikTok's followers activity heatmap** (when your audience is online by hour/day) is the single most actionable feature in creator analytics — it directly closes the loop between data and posting decision with zero interpretation required. **YouTube Studio's audience retention graph** (second-by-second drop-off on a specific video) is uniquely powerful because it diagnoses *why* a video underperformed, not just *that* it did — creators immediately see the hook failing or a segment losing interest. YouTube's **impression CTR benchmark** (showing your CTR vs. channel average) makes relative performance legible without requiring the creator to understand statistics. TikTok's **per-video traffic source breakdown** (For You vs. Search vs. Hashtag vs. Following) tells creators which discovery vector is working — this is structurally important intelligence for content strategy. Both platforms use **comparison sparklines** (this week vs. last week) rather than raw numbers in summary views, which reduces cognitive load dramatically.

---

### 4. User-Reported Pains

On Reddit (r/NewTubers, r/TikTokCreators) and Trustpilot reviews for tools like VidIQ and Social Blade, the dominant complaint is **metric overload with no signal** — "I have 47 numbers and I still don't know what to fix." Creators on r/NewTubers frequently report that YouTube Studio's 6-tab structure means they only ever look at the Overview, making the deep data invisible and unused. A recurring pain in TikTok creator forums is **data disappearing** — the 60-day mobile cap means creators lose context on what worked months ago right when they need it most for seasonal content planning. Clip-specific creators (gaming, sports, reaction) consistently complain that analytics tools don't distinguish between **organic discovery and direct share traffic** — a clip that went viral because a bigger creator shared it looks identical in dashboards to one that got recommended by the algorithm, which are fundamentally different signals. Across both platforms, creators report that **best-time-to-post recommendations are generic** ("post at 6pm EST") and not personalized to their specific audience location and behavior.

---

### 5. Opportunities for Viral Animal

**Velocity scoring on your own published clips** is completely absent from all competitors — you already compute velocity scores for *source clips* in `lib/scoring/clip-scorer.ts`, and applying the same momentum/early-signal logic to a creator's *own published posts* in the first 2-6h would surface a "this one is breaking out" alert before anyone else tells them. This is a native advantage no competitor has. **Cross-platform clip performance normalization** is a gap: when a creator posts the same clip to TikTok and (eventually) YouTube Shorts, no tool tells them which platform responded better to that specific clip format — Viral Animal owns both the clip and the publish event, so this comparison is architecturally trivial. A **"what's working" plain-language digest** (e.g., "Your 20-35s gaming clips with hook overlays got 2.3x more completion than your raw clips last month") would directly address the prescriptive gap competitors leave open, and could be generated cheaply with Haiku via the existing `agent-runner.ts` pattern. The **clip-to-post lineage** (which source clip → which enhance settings → which publish result) is data only Viral Animal holds, making it possible to tell creators "clips from this streamer with face-track enabled outperform by 40%" — a closed-loop insight impossible for any standalone analytics tool. Finally, a **personalized best-time-to-post** recommendation built from the user's own TikTok audience activity (via the existing `app/api/tiktok/creator-info/route.ts`) would directly replicate TikTok's heatmap feature inside Viral Animal's interface, keeping creators in the product instead of switching to TikTok Studio to check timing.

## FINAL RECOMMENDATION
Ship a two-part intervention targeting the two biggest structural blockers to d7_repeat_publish_rate. Part 1: Replace the diversity-weighted Viral Score with a 'Publish Momentum' streak widget. The current score is architecturally broken at low publication counts — it caps at ~27/100 when only TikTok is connected because diversity alone is worth 45 points. This is a structural demotivator that signals 'you are failing' to every new user. The new widget shows clips-this-week vs. clips-last-week with a comparison sparkline, a score that visibly increases only by publishing again, and always-visible copy showing the exact delta: 'Post 1 more clip this week → +10 pts'. Add Sonnet's decay alert as a sub-component: show two score states side-by-side ('Current: 65 / If you don't post this week: 25 — Getting Started') plus a countdown ('X days left to maintain streak') with a hard CTA that deep-links to the Enhance editor with their most recent clip pre-loaded, or to the top-scored trending clip in their last-published niche if no in-progress clips exist.

Part 2: Ship the First Results Loop. 24-48h after a user's first TikTok publish, trigger an in-app notification card pinned to the top of /dashboard/analytics (and optional email) showing real performance pulled from the existing refresh-post-stats cron + publications table. Frame it as a benchmark ('Your clip ranked better than X% of first clips on Viral Animal in [niche]') — this is the cohort comparison the intuition proposed, but placed at exactly the right moment (post-publish anxiety window) rather than as a passive dashboard. Pair it with ONE prescriptive CTA: 'Your next clip is ready — post [today] at [best time]' deep-linking to the top velocity_score clip in their niche from trending_clips. Both parts share the same behavioral logic: close the feedback loop immediately, always show the next action, never let the user hit a dead end.

**Rationale:** Both councils independently identified the Viral Score as a structural demotivator — this is the highest-conviction signal in the synthesis. Sonnet solved the 'decay alert' tactical problem, Opus solved the 'n=1 state' structural problem, and the intuition identified the 'benchmark framing' that makes results meaningful. The final recommendation stacks all three rather than choosing one: fix the broken score (Opus), add the decay mechanic (Sonnet), close the feedback loop with benchmarked first results (intuition, refined). The existing infrastructure makes this unusually low-risk: trending_clips.velocity_score and feed_category already exist, refresh-post-stats cron and publications table already exist, the settings Viral Score component is already isolated. This is primarily a display-layer + trigger-logic change, not a data pipeline change.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
The streak mechanic backfires if the median new user doesn't publish their first clip within the first week — the widget shows '0 clips this week / 0 last week' with a decay alert on a score they haven't even earned yet, creating anxiety rather than motivation. If onboarding data shows median time-to-first-publish > 7 days, the entire streak frame is wrong and the fix is gating the widget behind first publication. Secondary: the First Results Loop relies on TikTok returning view/like data within 24-48h; if the API latency or cron timing means the card shows 0 views at the retention-critical moment, it's worse than showing nothing — it signals the tool broke. The refresh-post-stats cron must be confirmed to run at least every 6h and TikTok must return non-zero data before the card is shown (add a guard: only show if views > 0).
**Severity:** 7/10

## Alternatives Rejected
- **Cohort benchmark dashboard (standalone analytics page showing views/clip vs. niche average):** Passive data viewing. Research consensus and both councils agree that dashboards don't drive behavioral change — users must encounter the benchmark at the moment of maximum motivational leverage (post-first-publish anxiety window), not when they navigate to analytics. A standalone page gets ignored by users who have already churned.
- **Patch the Viral Score formula to reduce diversity weighting (e.g., 15 pts instead of 45):** Technical fix without behavioral mechanic. Adjusting weights still produces a metric that doesn't tell the user what to DO. The Publish Momentum frame is superior because the user can directly observe the score moving as a result of publishing — the causal link is transparent and action-driving, not just less penalizing.
- **Full analytics page redesign with comparative charts:** Effort/impact ratio is poor. A full redesign risks breaking existing power-user workflows, takes 8-16h, and the core retention problem is about the 0-to-1 publish journey, not chart sophistication. The targeted widget + First Results Loop addresses the exact churn window (d1-d7) with 3-5h of effort.

## Confidence & Effort
- **Confidence:** 8/10
- **Estimated effort:** 5h
