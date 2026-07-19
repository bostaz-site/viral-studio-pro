# Lab Deep Dive — distribution-hub (cycle #1)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a one-click 'optimal time' scheduler that auto-picks the best posting window based on the user's TikTok audience activity data. Most users abandon the distribution step because choosing timing is friction — remove that decision entirely.
- **Risk:** Users bank clips but never actually publish — the queue fills up and becomes a graveyard, creating the illusion of activity without real output. Autofarm feels like set-and-forget but silently fails due to TikTok audio copyright flags or expired OAuth tokens.
- **Metric:** clips_published_per_user_per_week — measures whether the distribution hub converts enhanced clips into actual posts, not just scheduled intentions

## Target Metric (forced clarity)
- **Metric:** `enhance_to_publish_rate`
- **Minimum delta:** 15
- **Measurement:** SELECT COUNT(DISTINCT pp.clip_id)::float / NULLIF(COUNT(DISTINCT rj.clip_id), 0) FROM render_jobs rj LEFT JOIN published_posts pp ON pp.clip_id = rj.clip_id AND pp.created_at <= rj.updated_at + INTERVAL '24 hours' WHERE rj.status = 'done' AND rj.created_at > NOW() - INTERVAL '7 days'
- **Clarity:** 8/10

## Research Synthesis
## Multi-Platform Distribution + Smart Publishing — Research Synthesis

---

### 1. Industry Consensus

**Compose once, customize per platform** is table stakes — every serious tool from Buffer to Hootsuite does it, and users now consider it the minimum viable workflow. **Best-time-to-post** recommendations are universally expected, though the quality varies wildly (platform-wide averages vs. personal profile data). Queue-based publishing (fill a slot, forget it) has won over calendar-first workflows for solo creators because it reduces daily cognitive overhead. AI assist is universally moving toward caption generation and hashtag suggestions, but **no tool has pushed AI into the distribution decision itself** — they generate copy, not publishing strategy. There is broad consensus that friction between content creation and scheduling is the biggest drop-off point, which is why integrations (Canva, Adobe Express) and import pipelines matter so much.

---

### 2. Industry Disagreement

The market is split on **whether timing intelligence should be personal or population-level** — Hootsuite uses platform-wide aggregates on base tiers, Later uses per-creator profile data, Buffer uses day-specific engagement history. The ROI difference between these approaches is real but not yet proven definitively to users. There is genuine disagreement on **how much autonomy to give the tool**: Buffer and Later lean toward human-initiated every time; no mainstream scheduler has shipped fully autonomous publish (the liability and quality-control concerns are cited as blockers). Pricing philosophy is polarized — Buffer's per-channel model rewards simplicity, Hootsuite's flat enterprise fee rewards team scale, and neither works cleanly for a creator who has 1 TikTok account and wants power-user features. Finally, the market hasn't agreed on **whether a scheduler should touch the video itself** — Hootsuite outsources to Canva, Later ignores it entirely, only vertically integrated tools (CapCut, for instance) have tried to close the loop.

---

### 3. Competitor Best Moves

**Later's per-profile timing intelligence** is the sharpest implementation in the space — pulling recommendations from the creator's actual account data rather than global averages meaningfully improves CTR, and scoping it per platform in a single multi-publish flow is a UX win. **Buffer's Channel Groups** are underrated: saving a bundle of platforms and targeting them in one action removes a real daily annoyance for multi-platform creators and has no direct analog in competitors. **Hootsuite's bulk scheduling at 350 posts** reveals an underserved workflow for agencies and prolific creators who produce content in batches; the CSV import pattern is a power-user unlock that drives stickiness. **Later's "Future Trends" drafting** is directionally correct even if technically shallow — auto-drafting content around macro trends signals that the market is hungry for proactive, not reactive, publishing. Buffer's **contextual engagement alerts** ("your best-performing format has shifted") are a rare example of surfacing insight in context rather than burying it in an analytics tab.

---

### 4. User-Reported Pains

The most consistent complaint across Reddit, G2, and Capterra reviews is **TikTok's thumbnail/cover frame limitation** — every scheduler that uses the API forces the creator to open TikTok natively to set the cover, which destroys the "schedule and forget" promise for short-form video. **Broken or delayed publishing** is the second most cited issue, especially on Instagram and TikTok where API instability causes silent failures with no retry logic or user notification. Creators in gaming and streaming niches specifically report that **general schedulers are blind to trending moments** — by the time they manually clip, upload, and schedule, the viral window has closed. The "compose once" promise breaks down in practice because **captions, hashtags, and aspect ratios need genuine per-platform rethinking**, not just character-count trimming, which most tools handle superficially. A quieter but persistent pain is **quota anxiety** — creators on free or low-tier plans micromanage their monthly post limits, which creates hesitation and reduces the tool's actual usage.

---

### 5. Opportunities for Viral Animal

**The clip-to-published pipeline is completely unowned.** Every competitor assumes the video already exists and is ready to upload; Viral Animal is the only tool that controls the moment *before* — the enhance step — which means it can pre-fill captions from transcription, pre-select the best thumbnail frame, pre-generate hashtags from niche and mood detection, and hand a near-complete post to the publish dialog. That's a 10-minute workflow collapsed to 30 seconds.

**Urgency-aware publishing is a white space.** No competitor surfaces "this clip is in its viral window right now, post within 90 minutes" — they all treat scheduling as a calm, deliberate act. Viral Animal already has velocity scores and tier classification (`mega_viral`, `early_gem`) in `trending_clips`; surfacing that signal at publish time ("⚡ This clip is peaking — early posts get 3x more reach") is a differentiated CTA that no scheduler can replicate.

**Autonomous publish (autofarm) with a human-in-the-loop escape hatch** is the next frontier and no one has shipped it for video. The Smart Queue Engine in `lib/distribution/` is already positioned there — the missing piece is trust-building UX: a "what will be posted today" preview card sent to the user each morning, with a one-tap cancel, before the agent fires. This pattern (autonomous with override) is what makes auto-publishing feel safe rather than reckless.

**TikTok cover-frame selection at publish time** is a fixable pain point that all competitors have abandoned to the native app. If Viral Animal controls the render pipeline, it can let the user pick the cover frame in `UnifiedPublishDialog` and encode it into the upload payload — turning a known user frustration into a delighter that schedulers literally cannot match via standard API.

**Niche-aware timing** (gaming peaks Thursday–Saturday 7–11pm, not Tuesday 9am like Buffer's generic recommendation) is unimplemented everywhere. With `trending_clips.niche` already stored and clip performance data accumulating, Viral Animal can build timing models specific to streaming niches — a personalization layer that general schedulers will never invest in because their audience is too broad.

## FINAL RECOMMENDATION
Ship 'Zero-Decision Publish' as a two-part change. Part 1 (dialog pre-fill): When UnifiedPublishDialog auto-opens on render completion, it arrives fully populated from existing data — caption from distribution_settings.caption_template with {title} interpolated, hashtags from distribution_settings.default_hashtags (or niche presets from /api/distribution/optimize), and a single pre-selected slot computed from distribution_settings.optimal_hours + anti-shadowban spacing. The primary CTA reads 'Queue for Tuesday 7:40 PM (optimal) →' with a ghost 'Customize' link — the happy path is one click. If settings are empty (new user), show a single inline prompt 'Set your niche to unlock best times →' that opens a settings mini-tab in-dialog without blocking publish. If TikTok isn't connected, replace the CTA with an inline OAuth block — no redirect, no tab loss. Part 2 (render-wait caption generation): The moment a render job is enqueued, fire a parallel API call to generate the TikTok caption + hashtags via Claude Haiku using the clip's already-computed transcription and mood_analysis (both exist in DB from the enhance pipeline). Store the result in render_jobs.meta JSONB or a small publish_drafts table. When the dialog opens, it reads from this pre-generated draft first, falling back to distribution_settings templates. This hides a 3-5s LLM call inside 60-180s of render dead time — the user never waits for AI generation.

**Rationale:** Both councils converged on the same insight: the dialog must arrive pre-filled, not blank. The tension was about *when* to generate AI content — Sonnet said use stored templates (zero latency, zero new infrastructure), Opus said generate fresh AI copy during render wait (better quality, latency-hidden). The hybrid captures both: templates give instant fallback with zero risk, while the background Haiku call upgrades quality when render time allows. This is strictly better than either council's individual proposal. The original intuition (time picker) was too narrow — timing is one of three friction points (caption, hashtags, timing). The kill switch check forces us to handle the new-user empty-settings case explicitly, which both councils underspecified.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
New users (the highest-value convert target) have no distribution_settings — no caption_template, no default_hashtags, no optimal_hours. The 'pre-filled' dialog opens empty or with placeholder text. The AI caption generation also fails if no transcription exists (user uploaded a clip without going through the full enhance flow, or Whisper failed silently). Result: the dialog looks broken, not frictionless. The new user sees an empty form at the payoff moment — worse than the current experience because it creates false expectation. Secondary scenario: if the parallel Haiku call races and arrives *after* the dialog opens (render faster than expected on short clips), the pre-fill flash-updates from empty → filled, which feels glitchy. Both failure modes hit new users disproportionately.
**Severity:** 7/10

## Alternatives Rejected
- **Optimal-time picker only (original intuition):** Timing is one of three friction points. Solving it alone leaves caption and hashtag fields blank — the form is still a form. Enhance-to-publish rate improves marginally (~10-15%) instead of the 2-3x possible with full zero-decision flow.
- **OAuth pre-flight at 'Make it Viral' click (Opus standalone):** Requires detecting TikTok connection state before the enhance flow starts — adds a preflight check to a page that currently has no auth awareness. Good idea but high implementation surface for a secondary problem. Better handled reactively inline in the dialog with a well-designed OAuth block, which is lower-risk and still eliminates the tab-loss problem.
- **Store pre-generated caption in a new publish_drafts table:** Unnecessary schema migration. render_jobs.debug_log is already JSONB-adjacent — a meta column on render_jobs or a short-TTL Redis key (clip_id → draft JSON, 1h TTL) achieves the same with zero migration and auto-cleanup.

## Confidence & Effort
- **Confidence:** 8/10
- **Estimated effort:** 4h
