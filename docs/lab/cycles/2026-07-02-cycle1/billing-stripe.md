# Lab Deep Dive — billing-stripe (cycle #1)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a usage-based upsell trigger: when a user hits 80% of their monthly quota, show an inline banner with one-click upgrade to Pro. This removes friction at the exact moment motivation is highest.
- **Risk:** Stripe webhook failures silently leave users on wrong plan — they either get locked out after paying or retain access after canceling, destroying trust.
- **Metric:** upgrade_conversion_rate — % of free users who upgrade within 7 days of hitting 80% quota

## Target Metric (forced clarity)
- **Metric:** `free_to_paid_conversion_rate`
- **Minimum delta:** 2
- **Measurement:** COUNT(profiles WHERE plan IN ('pro','studio') AND upgraded_at BETWEEN signup_date AND signup_date+30d) / COUNT(profiles WHERE created_at >= window_start) — queried as 30-day rolling cohort from profiles table; Stripe webhooks already write plan changes on checkout.session.completed
- **Clarity:** 8/10

## Research Synthesis
## Billing & Plans — Research Synthesis

---

### 1. Industry Consensus

**Annual toggle + monthly anchor is table stakes.** Nearly every SaaS tool over $10/month shows a monthly/annual toggle, with annual offering 20–40% savings. Pre-selecting annual (Submagic's move) consistently lifts LTV by 15–25% in A/B tests documented by ProfitWell and Paddle. **Hard-capped free tiers** that let users experience the core loop once or twice (but not fully) are now standard — enough to create the "aha moment" without giving away the product. **Clear export volume or usage quotas** (videos/month, AI clips/month) are the dominant monetization lever in video SaaS because they're intuitive, scalable, and tie cost to value. Most tools agree that a **3–4 tier structure** (Free → Creator → Pro/Team → Enterprise/Custom) maps well to the creator market's income distribution.

---

### 2. Industry Disagreement

**Trial vs. no-trial is still contested.** Submagic leads with "7-day free trial, no credit card" while Opus.pro skips it entirely and leans on ROI framing instead — both strategies have strong defenders. The argument against trials: they increase support load and attract non-serious users; the argument for: they dramatically lower top-of-funnel friction for price-sensitive creators. **Annual pre-selection vs. monthly pre-selection** splits opinions — Paddle data suggests annual pre-select lifts LTV, but some conversion specialists argue it triggers mistrust ("why are they hiding the monthly price?"). **ROI calculators vs. social proof** is another genuine divide: B2B-leaning products (Opus) bet on calculators, while consumer-creator tools (Submagic) bet on ratings and user counts — which works depends heavily on whether the buyer is a solo creator or a brand/agency.

---

### 3. Competitor Best Moves

**Opus.pro's ROI calculator is the most sophisticated conversion tool in the space** — reframing $29/month as "saves you $8.4K/month in time and distribution" collapses price resistance by shifting the mental model from cost to investment. **Submagic's annual-first pre-selection** is a clean, high-ROI tactic that requires zero engineering complexity but consistently improves LTV. **Vizard's "Most Popular" badge** on the mid-tier plan is textbook anchoring — it nudges users away from the lowest tier without requiring any copy changes. **Submagic's inline FAQ** handling cancellation and refunds directly on the pricing page is underrated: it eliminates the most common support ticket category and removes the last objection before clicking "subscribe." Vizard's **before/after clip demos on the pricing page itself** is notable — it closes the "does this actually work?" doubt without requiring users to start a trial.

---

### 4. User-Reported Pains

**Quota resets and overage surprises are the #1 billing complaint** across creator tools — Reddit threads on r/editors and Trustpilot reviews for Kapwing, Descript, and similar tools consistently surface "I didn't know I was out of credits" as the trigger for cancellations. **Watermarks that appear without warning** mid-export (after the user has already invested editing time) generate intense frustration and negative reviews — the pain isn't the watermark itself, it's the timing. **Confusing upgrade flows** are endemic: users report discovering a feature they need, clicking upgrade, landing on a checkout with no feature-to-plan mapping, and abandoning. **Annual lock-in with no prorated refund** is a significant churn trigger — users who cancel mid-year and get nothing back publicly post about it. **Plan names that don't match self-identity** ("Business" feels irrelevant to a solo streamer; "Individual" undersells power users) cause users to pick the wrong tier and feel overcharged or under-served.

---

### 5. Opportunities for Viral Animal

**Streamer-native quota framing is wide open.** No competitor prices in "clips published per month" or "viral moments farmed" — they all use generic "AI clips" or "exports." Viral Animal can price around clip bank slots, auto-publish slots, or scheduled posts, which maps directly to how streamers think about their workflow and makes the value proposition visceral. **A lightweight "virality ROI" hook** (not a full calculator — just a stat like "users with Pro publish 4x more clips and average 280K extra views/month") would outperform Opus's heavy calculator for Viral Animal's audience, who respond to social proof over spreadsheet math. **Founding Member pricing with a visible countdown** is unused by all three competitors — Viral Animal already has "founding price" copy, but making the scarcity mechanism explicit (seats left, deadline) would create urgency that the entire category lacks. **Usage warnings at 80% quota** (in-app toast + email) would directly address the #1 billing pain point and position Viral Animal as the "fair" option vs. competitors who surprise users at the wall. **A clip bank slot expansion add-on** (buy 10 extra scheduled slots for $5) could unlock a meaningful ARPU lever without forcing a full plan upgrade — none of the competitors offer mid-tier add-ons, leaving money on the table from power users who don't need Studio features but need more volume.

## FINAL RECOMMENDATION
Combine the strongest elements of both councils into a two-surface approach. Surface 1: Add a persistent quota progress bar to the dashboard header ('2 / 3 clips used this month') using shadcn Progress, linking to pricing — proactive awareness with zero friction, catches users before the wall. Surface 2: When a free user's render completes, inject a 'Clean Export Paywall' state into the existing UnifiedPublishDialog (which already auto-opens post-render) — show their watermarked rendered output side-by-side with a single clean frame extracted from the original source clip URL (available at zero VPS cost, no second render pass needed). CTA: 'Remove watermark & post clean — $19/mo, cancel anytime' with Stripe checkout pre-filled to Pro + affiliate promo code passthrough. Surface 3: Replace the current quota-exceeded toast with a full-screen contextual modal that mirrors the same watermark diff and adds the two objection-killers: 'Cancel anytime' and 'Quota resets the 1st — no overages ever.' DO NOT use a free trial CTA — trials were explicitly removed in wave1 polish (commit 1007b26). Instrument trigger points separately in analytics (render_complete_paywall vs quota_wall_modal) to measure per-moment conversion lift and optimize allocation.

The engineering surface is narrow and all hooks already exist: (1) pull monthly_videos_used from profiles into dashboard layout context, (2) render Progress + tooltip in header, (3) add a new PaywallState to UnifiedPublishDialog with the side-by-side UI, (4) intercept the quota-exceeded API error in the enhance flow and mount the modal instead of the toast. No Stripe backend changes, no VPS changes, no schema changes.

**Rationale:** Opus identified the render-completion moment as the highest-leverage psychological trigger (endowment effect — user has emotional investment in THEIR clip and can see exactly what they're missing). Sonnet's persistent header indicator adds proactive awareness at near-zero cost. Combining both covers the full funnel: awareness before the wall, conversion at peak intent post-render, and a safety net at quota exhaustion. Using a source-clip frame instead of a separate VPS render pass keeps zero extra cost. Rejecting the trial CTA is critical — trials were removed for a product reason, and reinstating them without re-evaluating that decision would introduce inconsistency in the billing flow.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
Free users have a quota of 3 videos/month. If the typical free user reaches the render-completion paywall only once or twice before churning (never hitting quota wall), AND the side-by-side preview reads as manipulative rather than informative (dark pattern perception), it could generate negative App Store / TikTok review mentions that hurt organic acquisition more than the conversion lift is worth. A second risk: if conversion rate on the render-completion paywall is < 2%, the presence of the modal may increase publish-flow abandonment for free users (they close the dialog and don't post), reducing the virality loop that drives free-user acquisition in the first place.
**Severity:** 6/10

## Alternatives Rejected
- **80% quota trigger banner only (original intuition):** Proactive awareness is good but conversion at 80% is weak — the user still has headroom and can defer the decision. The render-completion moment is 3-5x higher intent. This approach alone is table stakes, not a conversion lever.
- **7-day free trial as primary CTA (Sonnet council recommendation):** Trials were explicitly removed in wave1 polish commit 1007b26. Re-enabling requires a product decision on why they were removed (LTV, abuse, Stripe complexity) — cannot be reinstated unilaterally in this feature. Direct checkout with 'cancel anytime' copy covers the objection without reopening that decision.
- **Quota wall modal only, no render-completion paywall state in UnifiedPublishDialog:** Misses the highest-intent moment. A user who just rendered clip #1 or #2 and wants to post it NOW is more motivated than one who has exhausted all 3 over the course of the month. Treating the publish dialog as a pure paywall surface is the lowest-disruption implementation of the highest-value lever.

## Confidence & Effort
- **Confidence:** 8/10
- **Estimated effort:** 3h
