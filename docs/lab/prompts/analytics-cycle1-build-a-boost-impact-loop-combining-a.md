# Lab Prompt — analytics (cycle #1)

> Auto-generated from Lab deep dive on 2026-06-30

## Target Metric
**weekly_active_exporters_rate** — minimum delta: 10

Measurement: COUNT(DISTINCT user_id FROM clips WHERE status='done' AND created_at > NOW()-7d) / COUNT(*) FROM profiles — measured weekly, comparing cohorts who viewed analytics dashboard vs. those who did not

## Final Recommendation
Build a 'Boost Impact Loop' combining a day-5 re-engagement trigger with an in-app impact surface. On day 5 post-export, run a background job that queries the user's connected social account (OAuth already in social_accounts) for the exported clip's view count. Compare against their median_views_per_video from account_snapshots. Send a single email: if outperformed → 'Your captioned clip got X views — Yx your usual average. Here's your next clip.' If underperformed → 'Trending clip ready for you — boost it before the weekend.' Both CTAs deep-link to the enhance editor with the clip pre-loaded and last-used boost settings restored from the render_jobs record. Inside the app, add a 'Recent Export Impact' card at the top of the dashboard showing: clip thumbnail, boosts applied (captions/split-screen/reorder checkmarks), export date, and platform views fetched lazily. Below it, a static 'Ready to Boost' row: 3 clips ranked by viral_score from the user's niche, each with a single 'Boost Now' button. This is the minimum viable closed loop — one email, one in-app card, one frictionless next action.

## Rationale
Both councils converge on the same core insight: the missing piece is not better editing tools (the intuition's retention curve) but closing the feedback loop after export. Users export into a void — they never see whether their edits worked, so there's no emotional pull to return. The day-5 timing (Sonnet) beats weekly digest (Opus) because it catches users before the 7-day active window closes; weekly digests aggregate impact and dilute urgency. Sonnet's conditional logic (outperformed vs underperformed → different CTA) is the highest-leverage detail: it ensures every re-engagement message is personalized and non-generic. Opus's 'Ready to Boost' queue is kept because it eliminates the #1 friction point after re-engagement: deciding what to edit next. The retention curve overlay is rejected as the primary initiative because it improves export quality, not export frequency — wrong lever for weekly_active_exporters_rate.

## Kill Switch — MUST ADDRESS (severity 8/10)
The entire feedback loop depends on users having a connected social account with a valid OAuth token. If <25% of active exporters have connected YouTube/TikTok (plausible given optional onboarding), the day-5 email shows no performance data for the majority of users, degenerating into a generic re-engagement email that will be ignored or unsubscribed. Simultaneously, TikTok's API has historically restricted third-party view count access — if TikTok clips (likely the primary export target for virality) can't be tracked, half the value disappears. A second kill switch: if the render_jobs table doesn't reliably store 'last-used boost settings' in a retrievable format, the deep-link pre-load feature — the friction-elimination centerpiece — silently fails and users land on a blank editor, defeating the re-engagement momentum.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Retention curve overlay in the enhance editor (original intuition): Improves per-export quality, not return rate. A user who exports a better clip once and never returns still scores 0 on weekly_active_exporters_rate. Wrong lever for the target metric. Valuable as a v2 feature once re-engagement is established.
- Weekly export streak counter + Sunday digest email (Opus full proposal): Streak mechanics require consecutive weekly exports to be meaningful — users who lapsed already see a broken streak and feel penalized rather than motivated. Sunday digest timing is too slow and too aggregated; urgency is lost. The full Opus proposal is 3-4x the scope for uncertain incremental gain over the focused day-5 trigger.
- Push notifications for export impact (Sonnet proposal element): Web push notification permission rates are typically 5-15% on opt-in flows. Building the notification infrastructure for a 10% reach ceiling is poor ROI compared to email, which has 100% reach for any user with an account. Defer push to after email proves the loop works.

## Effort
~5.6h with Claude Code (28h human estimate)

## Confidence: 7/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(analytics): lab cycle 1`
- [ ] Push to origin
