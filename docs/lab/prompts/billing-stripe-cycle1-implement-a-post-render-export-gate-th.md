# Lab Prompt — billing-stripe (cycle #1)

> Auto-generated from Lab deep dive on 2026-06-30

## Target Metric
**free_to_paid_conversion_rate** — minimum delta: 3

Measurement: COUNT(DISTINCT user_id WHERE plan != 'free' AND stripe_customer_id IS NOT NULL) / COUNT(DISTINCT user_id WHERE plan = 'free' AND created_at <= NOW() - INTERVAL '7 days') over a rolling 30d window, segmented by cohort signup week

## Final Recommendation
Implement a 'Post-Render Export Gate' that fires immediately after Railway returns the completed render. The screen auto-plays the watermarked clip with a real-time toggle ('with watermark / without') showing the delta on a frozen frame — making loss aversion visceral and personal rather than hypothetical. The primary CTA is 'Start 7-Day Free Trial — Download Clean' (Stripe Checkout, pre-filled), never blocking the download: a visually de-emphasized 'Download with watermark' link always remains visible to preserve trust and reduce rage-abandonment. Pair with two urgency layers: (1) a 10-minute countdown ('Your clean render is reserved — upgrade before it expires') backed by real 24h storage on Railway so the promise is not a lie, and (2) a Viral Score badge ('This clip scored 79/100') with the score visible but the factor breakdown locked behind Pro, creating explicit FOMO on clip-specific data the user now cares about.

The gate replaces any pre-render blocking. Free tier still gets 3 renders/month, but the wall hits after — when the user has already invested time editing, waited for the render, and watched their clip look good. Show remaining monthly renders ('2 of 3 renders used') to layer scarcity on top of sunk cost. The watermark is a corner logo at 40% opacity — obviously branded, clearly removable, but never obscuring the clip's content enough to make it unwatchable or unshareable. This distinction matters: the clip must feel 'almost there' not 'ruined'.

Implementation touches: (a) render pipeline already on Railway — add a flag `watermarked: true` to the job payload for free users, (b) Viral Score is computed via the existing `clip-scorer.ts` logic adapted for user clips (no new infrastructure), (c) Stripe Checkout session created server-side on modal open with `trial_period_days: 7`, (d) 24h signed URL stored in `render_jobs.clip_url` — already exists in schema, just enforce TTL.

## Rationale
Both councils independently converged on post-render timing as the highest-leverage intervention — this is a strong signal. The side-by-side toggle (Opus) is the single highest-conviction differentiator from raw intuition: static watermark is passive, live toggle is active loss aversion. The 7-day trial (Opus) lowers friction more than a direct paid upgrade. The time-limited urgency + 24h storage promise (Sonnet) is included because it converts the emotional peak into a real deadline without being dishonest — the render IS stored. The Viral Score hook (Sonnet) is included because it leverages existing infrastructure at near-zero cost and adds a second, data-driven FOMO vector. The 'download with watermark' escape hatch (Opus) is non-negotiable: blocking it kills trust and triggers chargebacks/complaints that cost more than the conversion is worth.

## Kill Switch — MUST ADDRESS (severity 7/10)
The entire mechanic assumes users care enough about the watermark to pay to remove it. If the target user segment (small streamers, beginners, casual clip makers) is fine sharing watermarked content — or if the Viral Animal watermark is actually perceived as a badge/clout signal rather than a liability — the conversion moment becomes emotionally neutral or even positive, collapsing the loss aversion dynamic entirely. Additionally: if Railway render times regularly exceed 90 seconds, a significant fraction of free users will abandon before seeing the gate, meaning the funnel never reaches the conversion screen. A secondary kill switch: if the 7-day trial converts poorly to paid (churn > 80%), the post-render gate generates trial users who download their clean clip and immediately cancel, costing Railway compute with zero revenue. This would require switching to a hard paywall (no trial) — the opposite of the recommended low-friction entry.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Pre-render paywall: block rendering entirely for users who have hit their monthly limit, show upgrade modal before the job is submitted to Railway.: Fires at zero emotional investment — user hasn't seen their clip yet and has no sunk cost. Conversion rates for pre-value paywalls are 3-5x lower than post-value gates in SaaS. Also wastes the single most powerful moment in the funnel (the completed render) by never reaching it.
- Full-overlay watermark (50% opacity logo centered on frame) to make the clip unshare-able without upgrading.: Destroys the 'almost there' emotional state. Users feel cheated rather than motivated. The clip becomes unusable, which triggers abandonment rather than conversion — and generates negative word-of-mouth. Trust erosion outweighs conversion lift.
- Inline editor upgrade prompt (original intuition): surface the paywall as a tooltip or banner within the enhance editor when a Pro feature is touched.: Fires too early (before the user has seen their finished clip) and interrupts workflow at a moment of creation rather than completion. The emotional state is 'building' not 'achieved' — loss aversion doesn't activate the same way. Weaker than post-render by design.

## Effort
~3.6h with Claude Code (18h human estimate)

## Confidence: 7/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(billing-stripe): lab cycle 1`
- [ ] Push to origin
