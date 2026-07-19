# Lab Deep Dive — analytics (cycle #2)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a 'clip performance after publish' loop that shows users which clip styles, hooks, and formats actually drove TikTok views — closing the feedback loop so they optimize future clips based on real outcomes, not guesses.
- **Risk:** Users see vanity metrics (renders done, clips published) but can't connect those actions to follower/view growth, making analytics feel pointless and causing churn from perceived lack of ROI.
- **Metric:** views_per_published_clip — average TikTok views earned per clip published through the platform, measured 48h post-publish

## Target Metric (forced clarity)
- **Metric:** `d30_retention_rate`
- **Minimum delta:** 10
- **Measurement:** COUNT(profiles WHERE first_publish_at < NOW()-30d AND EXISTS(SELECT 1 FROM published_posts WHERE user_id=profiles.id AND created_at > NOW()-7d)) / COUNT(profiles WHERE first_publish_at < NOW()-30d) — measured over rolling 30d window
- **Clarity:** 8/10

## Research Synthesis
## User Analytics — Research Synthesis for Viral Animal

---

### 1. Industry Consensus

The field has converged on **per-content granularity over channel-level averages** — every major tool now shows metrics at the individual video level because aggregate stats mask what actually works. **Watch time / completion rate** is universally treated as the primary success signal, displacing raw view counts (YouTube, TikTok, Reels, and every third-party tool like Vidiq or TubeBuddy all lead with it). Time-windowed comparisons (7d / 28d / 90d) are table stakes — users need relative context, not absolute numbers. There's also strong consensus that **posting time optimization** belongs in analytics (TikTok's activity heatmap, later.com's best-time feature, Hootsuite's scheduling suggestions all converge here). Finally, the funnel model — Impressions → CTR → Views → Retention — has become the default mental model for explaining performance.

---

### 2. Industry Disagreement

The biggest split is between **data richness vs. opinionated simplicity**: YouTube Studio and Sprout Social prioritize depth and let users draw their own conclusions, while TikTok Analytics and Buffer deliberately strip data to force focus. There's no clear winner — power users churn from simple tools, beginners churn from complex ones. A second disagreement: **should analytics prescribe actions or just report facts?** Tools like Vidiq and TubeBuddy have moved hard into AI recommendations ("post on Thursday at 6pm", "add this tag"), while YouTube/TikTok remain purely descriptive — the prescriptive camp wins on engagement but risks eroding trust when suggestions are wrong. Third: **real-time vs. delayed data** — some teams argue real-time is a distraction that causes anxiety-driven over-publishing; others (particularly in the short-form space) argue that the first 2 hours after posting are the only window that matters for algorithmic distribution, making real-time essential.

---

### 3. Competitor Best Moves

**TikTok's follower activity heatmap** is the single most directly actionable feature in any social analytics product — it turns passive data into a specific scheduling decision with zero interpretation required. **YouTube's traffic source breakdown** (FYP vs. search vs. suggested vs. external) is genuinely differentiated because it tells creators *why* a video reached its audience, not just *that* it did — this is causal insight, not just descriptive. **Vidiq's "opportunity score"** per video (estimated competition vs. search demand) is the best example of collapsing a multi-factor analysis into a single actionable number, which creators with limited time strongly prefer. TikTok's per-video **reached audience vs. followers split** is quietly powerful — a high ratio means the algorithm is distributing to cold audiences, the exact signal a viral-focused creator needs. YouTube's **subscriber gain/loss per video** surfaces which content builds durable audience vs. one-time traffic, a distinction completely missing from TikTok.

---

### 4. User-Reported Pains

The dominant complaint across Reddit (r/NewTubers, r/TikTokCreators), Trustpilot reviews of Hootsuite/Later, and YouTube Studio community forums is: **"I see the numbers but I don't know what to do next."** Data without interpretation is perceived as noise, not insight. Second most common: **cross-platform blindness** — creators who post the same clip to TikTok, Reels, and YouTube Shorts are forced to manually reconcile three dashboards to understand which platform worked, then mentally deduplicate views. Third: **data delay anxiety** — YouTube's 24-72h lag means creators can't learn from a post while it's still in the algorithm's active distribution window. On the other end, several creators report that checking TikTok analytics too early (1-2h post) gave misleading signals and caused them to delete clips that would have had delayed virality. Fourth: **no clip-level retention curve** — creators know their 30s clip was watched at 40% completion rate on average but have no idea if viewers dropped at second 3 (bad hook) or second 25 (weak ending). The Whisper/caption timing data to solve this exists; nobody has shipped it.

---

### 5. Opportunities for Viral Animal

**The drop-off curve per clip is the highest-value unreleased feature in short-form video.** You have word-level Whisper timestamps; correlating them with watch time data from TikTok's API would let you show a waveform overlay on the clip timeline where viewers dropped — pinpointing whether it was the hook, a dead moment, or an abrupt cut. No tool offers this at the clip level. **Cross-platform unified performance** is a clear gap: show TikTok views + (future) Reels/Shorts performance per clip in one row, with a "best platform" badge — this is a direct workflow win for creators who multi-post. **AI-generated clip autopsy** fits naturally into your existing AI surface area: after 48h, a one-sentence summary like *"Hook held 73% past 3s (top 15%), but completion rate dropped to 31% at the caption gap around 18s — consider tightening the pacing there"* would be uniquely defensible and directly tied to the clip editing workflow. **Best time to publish** computed from the user's own TikTok post history (via the creator-info route you already have) is a quick win that TikTok only approximates with a follower heatmap — you can be more precise by modeling *when their clips historically got FYP distribution*. Finally: **clip-to-clip comparison** (side by side: your hook-first edit vs. the original) would close the feedback loop that currently sends users back to TikTok Studio after every export — keeping the learning cycle inside Viral Animal.

## FINAL RECOMMENDATION
Extend the existing `publication_performance` table and `refresh-post-stats` cron to pull real TikTok video metrics (views, likes, shares, comments) using the video_id returned by the Direct Post API at publish time. Schedule 4 automatic fetch windows: 2h, 24h, 72h, 7d post-publish — aggressive early (every 2h for first 48h as Opus suggests), then daily. The TikTok video_id must be captured and stored in `published_posts` at the moment of publish via the existing `UnifiedPublishDialog` → `/api/publish/tiktok` pipeline. This is the gating dependency everything else depends on.

On the analytics surface: replace the current Top Clips widget (ranked by platform count, a posting-frequency vanity metric) with a real performance leaderboard ranked by 72h views. Add a per-clip Post Report card showing views trajectory, and a 'cold reach' ratio (views ÷ user's own median post views — the signal viral creators actually care about, not absolute views). Recompute the Viral Score from actual performance (hit rate above own median, not posting frequency) so it becomes a number users want to improve. This removes the biggest credibility problem with current analytics.

The retention hook is the 24h in-app notification: 'Your clip hit 4,200 views — 3x your median.' This fires for every published clip and creates a guaranteed structured return visit 24h after every publish event. A user posting weekly gets ~4 structured touchpoints/month from notifications alone. The compounding effect: they return, see their Post Report, feel the win (or the miss), and the next publish CTA is right there. This is the mechanical driver of d30 retention — not the analytics themselves, but the notification-as-pull-back loop they enable.

**Rationale:** Both councils converge hard on: store video_id at publish, fetch at 24h+72h, replace vanity metrics with real performance data, trigger re-engagement notification. These 4 points have high confidence. Opus adds 'cold reach' (views vs own baseline rather than absolute) which is the right framing for a viral tool — absolute view counts are meaningless for new users with zero following. The aggressive 2h fetch schedule from Opus is correct because the first 2-6h of TikTok distribution is when the algorithm decides reach — that data point is the most strategically valuable. Sonnet's weekly banner is a weaker version of Opus's per-clip 24h trigger: weekly is too slow and loses the emotional peak of a recent post. The existing cron infrastructure (refresh-post-stats) and table (publication_performance) mean this is extension work, not greenfield — reducing risk significantly.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
TikTok's Direct Post API (which we have approved) may not expose per-video analytics. The approved Direct Post API gives a publish_id for upload status checks — but reading video views/likes/shares may require the Video API or Creator Marketplace API, which are separate approval tracks. CLAUDE.md explicitly flags Stage 4 (TikTok Creator Info) as 'bloqué par permissions API'. If the analytics read endpoints require unapproved scopes, the entire feature has no data source and collapses to zero. The fix path (apply for additional TikTok API permissions) is months-long with no guaranteed approval. Before building anything else, we must validate that the approved Direct Post API token can call a video stats endpoint and get non-empty data for a real published video.
**Severity:** 8/10

## Alternatives Rejected
- **Weekly digest email summarizing all posts from the past week:** Loses the emotional peak moment. A creator checks TikTok manually within 2h of posting — by day 7, the result is stale news. The retention trigger only works when the notification arrives at the moment the creator is wondering 'how did it do?' — which is 24-48h post-publish, not a week later.
- **Manual 'Refresh Stats' button in the analytics dashboard:** Zero retention value — it requires the user to already be in the app, already engaged. The point is the notification that pulls them back when they're not in the app. A manual refresh adds zero structured touchpoints to the 30-day journey.
- **Full analytics rebuild with custom attribution (UTM tracking, referrer parsing):** TikTok strips referrer data and UTM params on redirect for privacy reasons. Attribution is a dead end for in-app TikTok traffic. The correct data source is TikTok's own API metrics, not click-tracking. Also massively over-engineered vs the existing publication_performance infrastructure.

## Confidence & Effort
- **Confidence:** 7/10
- **Estimated effort:** 5h
