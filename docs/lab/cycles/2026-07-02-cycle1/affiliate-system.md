# Lab Deep Dive — affiliate-system (cycle #1)

## Intuition Snap (pre-research baseline)
- **Solution:** Add a real-time earnings dashboard with a viral referral widget that affiliates can embed or share as a one-click link. Most affiliate programs die because affiliates forget they exist — a live counter showing earnings + a frictionless share button keeps them active.
- **Risk:** Affiliates recruit low-quality users who churn immediately, eating commission costs without generating real revenue. A 30% commission on churned free trials is pure loss.
- **Metric:** Affiliate-driven LTV ratio — (average LTV of referred users) / (average LTV of organic users). Success = ratio >= 0.8, meaning referred users are nearly as sticky as organic ones.

## Target Metric (forced clarity)
- **Metric:** `affiliate_referred_paid_conversions_30d`
- **Minimum delta:** 10
- **Measurement:** SELECT COUNT(*) FROM affiliate_referrals r JOIN profiles p ON p.id = r.referred_user_id WHERE p.plan IN ('pro','studio') AND r.created_at > NOW() - INTERVAL '30 days' — baseline queryable today from existing affiliate_referrals + profiles tables; track monthly cohorts via affiliate_commission_ledger
- **Clarity:** 8/10

## Research Synthesis
## Affiliate / Referral Program — Research Synthesis

---

### 1. Industry Consensus

Recurring commissions have become the SaaS affiliate standard because they align incentives with retention rather than just acquisition — affiliates who earn monthly residuals actively advocate long-term. The baseline for competitive programs in 2025-2026 sits at 20-30% recurring, with tools like ConvertKit, Beehiiv, and Lemon Squeezy all operating in this range. Double-sided rewards (referrer + referee both benefit) consistently outperform one-sided programs by 35-50% on conversion, with Dropbox's storage-for-both model remaining the canonical example. Attribution windows below 30 days are now considered hostile to affiliates; 60-90 days is table stakes. In-dashboard referral tracking (real-time, not email-delayed) is expected by 2025 affiliates — opacity kills activation.

---

### 2. Industry Disagreement

**One-time bonus vs. pure recurring** splits the field: Notion and Figma use flat per-seat bonuses and argue they're simpler to model financially; ConvertKit and Beehiiv use pure recurring and report higher affiliate lifetime engagement. **Third-party network vs. in-house** is the other major fault line — PartnerStack/Impact offer fraud protection and payment infrastructure but add a login-wall that kills casual affiliate activation (studies show 40%+ of approved affiliates never log into the affiliate platform). **Commission cap vs. uncapped** divides finance-driven founders from growth-driven ones; the data generally favors uncapped for top-performer retention but creates budget unpredictability at scale. Whether to gate the affiliate program (application + approval) or make it open-to-all remains genuinely contested, with approval gates working better for B2B and open programs working better for creator/prosumer tools.

---

### 3. Competitor Best Moves

Circle's tiered escalating structure (10% → 15% → 20%) is smart because it creates a natural upgrade incentive: affiliates who hit 10 referrals don't churn the program, they double down. Their dual-layer architecture — Circle's own affiliate program plus Circle-powered affiliate tools for customers — compounds the moat, since every community owner they convert becomes a distribution node. The $100 one-time bonus stacked on top of recurring is well-calibrated for creator-type affiliates who need an immediate win to feel the program is "real." PartnerStack handling fraud and payments removes the #1 operational headache for founders but introduces the separate-login friction problem. The critical gap across all three competitors: **none have built the referral mechanic into the product output itself** — the thing the user creates and shares is never the referral vehicle.

---

### 4. User-Reported Pains

The most common complaint on Reddit (r/juststart, r/Affiliatemarketing) and Trustpilot reviews for SaaS affiliate programs is **payout threshold friction** — minimum balances of $50-100 before withdrawal, combined with net-30 or net-60 delays, cause affiliates to lose momentum and go dormant. Second is **attribution opacity**: affiliates can't see which click converted, making it impossible to optimize their promotion strategy, which kills serious affiliates while keeping only the casual ones. Third is **cookie reset abuse** — referred users clearing cookies or using multiple devices causes disputed commissions and erodes affiliate trust. Fourth, creator-type affiliates (streamers, YouTubers, TikTokers) consistently report that **generic text affiliate links feel off-brand** — they want embeddable widgets, pre-made assets, or links attached to content they're already sharing. Fifth: in tools with watermarks or social sharing flows, users frequently complain the watermark is a barrier rather than an asset — nobody has figured out making the watermark *wanted*.

---

### 5. Opportunities for Viral Animal

**The output IS the referral vehicle.** Every TikTok clip exported with a subtle "Made with Viral Animal" tag or watermark is distributed to an audience of potential users — this is a loop no competitor has weaponized. A "share your clip → unlock render credits" mechanic, where the referral link is embedded in the TikTok caption flow, turns normal product usage into passive acquisition with zero affiliate friction. **Streamer-community referrals** are untapped: streamers have Discord servers and Twitch communities where a leaderboard ("Top 3 referrers this month get Studio plan") would spread organically in ways a newsletter affiliate never could. **Double-sided render credits** (referee gets 5 free renders, referrer gets 10) would lower the friction to trial for referred users while keeping the reward meaningful for creators who measure output, not money. **In-platform shareable referral cards** — "I turned this clip viral with X tool" — styled to match the clip's aesthetic would feel native to a video-editing audience rather than transactional. Finally, since Viral Animal's core value prop is speed-to-viral, a **"referred by [creator]" attribution page** that shows the referrer's best-performing clips would itself be social proof, closing the loop between affiliate incentive and product credibility.

## FINAL RECOMMENDATION
Wire the affiliate promo code end-to-end in Stripe and surface it at peak intent. Today the attribution cookie works and the promo_code string exists in the affiliates table, but there is no Stripe Coupon/Promotion Code created programmatically — referred users must discover and type the code themselves, which is where conversion dies. Fix: (1) on signup with a referral cookie, read the affiliate's promo_code, call Stripe to create/retrieve a PromotionCode with redeem_by = now+7days, store it on the user's profile (discount_code, discount_expires_at); (2) in the Stripe checkout session route, auto-apply that promotion code for attributed free users; (3) add a persistent dashboard banner for referred free users showing 'Your 20% off from @{handle} — expires in N days' with a direct upgrade CTA. Then add one high-leverage trigger on top: when a referred free user completes their first render and the watermark is shown, fire a full-screen modal ('Your 20% discount from @{handle} is ready — $15.20/mo instead of $19') with a Stripe checkout link that pre-fills the code and shows the countdown. The watermark moment is peak intent — the user just experienced both the product value and the paid-only barrier simultaneously.

**Rationale:** Both Sonnet and Opus independently converged on the same root cause (Stripe not wired, manual code entry kills conversion) and the same fix (auto-apply + time-box + banner). This is high-confidence signal. Sonnet added the peak-intent trigger insight (first render + watermark = highest conversion window) which Opus did not explicitly surface but is orthogonal and additive, not contradictory. The intuition's earnings dashboard is the wrong lever for this metric — affiliate retention is not the bottleneck, referred-user conversion is. The double-sided reward mechanic (referee gets discount, affiliate gets commission) is well-documented to lift conversion 35-50% vs single-sided programs, and the existing attributed-but-unconverted free user pool means this generates immediate conversions before any new traffic.

## Kill Switch (anti-bullshit)
**"What would make this completely wrong?"**
The entire approach assumes referred users fail to convert because of checkout friction (manual promo code). If instead they churn because the product fails to deliver value in the first session — bad render quality, confusing UX, TikTok upload failing — then removing checkout friction is irrelevant: users are leaving before they even reach a paywall. Additionally, if the affiliate traffic is low-intent or incentivized (affiliates sending their own alts or cold audiences that signed up only for the freebie), the attribution pool is poisoned and no amount of conversion optimization helps. A secondary kill switch: if the Stripe auto-apply interacts badly with existing coupons, plan pricing, or trial logic and causes checkout errors, it actively destroys conversion instead of improving it.
**Severity:** 7/10

## Alternatives Rejected
- **Affiliate-side earnings dashboard + embeddable referral widget (original intuition):** Wrong side of the funnel for the target metric. Affiliate engagement is not the bottleneck — attribution is already working. The gap is referred-user → paid conversion, not affiliate → referral generation. A beautiful dashboard doesn't move affiliate_referred_paid_conversions_30d if the referred users aren't converting.
- **Email drip sequence targeting referred free users with discount reminder:** Lower intent, lower open rate, slower feedback loop than in-product. Users who are going to convert via email would likely convert via in-product trigger too, but not vice versa. Email also requires the user to re-enter the product and reach peak intent again — the in-product modal does it at the exact right moment.
- **Apply a discount to all free users (not just referred ones) to lift overall paid conversion:** Destroys the affiliate value proposition — if everyone gets the discount, the referral is worth nothing. Also dilutes revenue margin on organic signups who would have converted at full price. The asymmetry (referred users get the deal, others don't) is what makes the affiliate's share link feel valuable.

## Confidence & Effort
- **Confidence:** 7/10
- **Estimated effort:** 4h
