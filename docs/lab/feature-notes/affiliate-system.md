# Lab Notes — affiliate-system


---

## Cycle #1 — 2026-07-02

Wire the affiliate promo code end-to-end in Stripe and surface it at peak intent. Today the attribution cookie works and the promo_code string exists in the affiliates table, but there is no Stripe Coupon/Promotion Code created programmatically — referred users must discover and type the code themselves, which is where conversion dies. Fix: (1) on signup with a referral cookie, read the affiliate's promo_code, call Stripe to create/retrieve a PromotionCode with redeem_by = now+7days, store it on

**Confidence**: 7/10 | **Effort**: 4h
**Kill switch**: The entire approach assumes referred users fail to convert because of checkout friction (manual promo code). If instead they churn because the product fails to deliver value in the first session — bad render quality, confusing UX, TikTok upload failing — then removing checkout friction is irrelevant: users are leaving before they even reach a paywall. Additionally, if the affiliate traffic is low-intent or incentivized (affiliates sending their own alts or cold audiences that signed up only for the freebie), the attribution pool is poisoned and no amount of conversion optimization helps. A secondary kill switch: if the Stripe auto-apply interacts badly with existing coupons, plan pricing, or trial logic and causes checkout errors, it actively destroys conversion instead of improving it.
[Full deep dive](../cycles/2026-07-02-cycle1/affiliate-system.md)


---

## Cycle #2 — 2026-07-03

Merge both council recommendations into a two-layer system. Layer 1 (Opus backbone): auto-apply the affiliate's Stripe Promotion Code from the moment the referred user lands — no promo code typing, zero trust loss from forgotten strings. Generate a Stripe promo code per affiliate at creation time, store stripe_promo_code_id on the affiliates row, persist the ref cookie through signup, and auto-apply at Stripe Checkout. Surface it as a persistent 7-day activation banner ('Samy got you 20% off Pro

**Confidence**: 7/10 | **Effort**: 6h
**Kill switch**: The intercept modal fires at render completion, which is ALSO when UnifiedPublishDialog auto-opens — the primary CTA in the existing flow. If referred users already have 15-30% higher purchase intent than organic (highly plausible given trust signal from the affiliate), forcing them through an extra modal before they can publish may trigger abandonment, reducing both immediate engagement AND the conversion we're trying to lift. The publish moment is emotionally time-sensitive; friction here costs more than in any other part of the funnel. Secondary risk: Stripe Promotion Codes generated per affiliate require a backfill migration for all existing affiliates — without it, auto-apply silently breaks for 100% of current affiliates on day 1. Both require an A/B test flag and migration script before full rollout.
[Full deep dive](../cycles/2026-07-03-cycle2/affiliate-system.md)


---

## Cycle #2 — 2026-07-03

Auto-apply the affiliate's discount at Stripe Checkout and surface it prominently at the two highest-intent moments: (1) a persistent but subtle in-app banner on the dashboard from day 1 ('Your 20% discount from @samy is active — X days left'), and (2) a redesigned quota-limit paywall that shows the discounted price pre-applied with a countdown. On signup, if a referral cookie exists, read the affiliate's discount from the referral row (promo_discount_percent already in schema), store it on the 

**Confidence**: 8/10 | **Effort**: 4h
**Kill switch**: Free plan is 3 videos/month. Power users who get referred by an affiliate may use all 3 videos in day 1 — the system works perfectly for them. But casual referred users might use 1 video in month 1, never hit quota, and sit on an unused discount that expires. Worse: if the VPS render pipeline is slow or the product doesn't deliver value in the first session, referred users churn before ever hitting quota — the discount is irrelevant. The entire mechanism assumes the product creates enough value fast enough to make users want more. If Day-1 activation is broken (user can't get a good clip on first try), no discount mechanic saves the funnel. Additionally: if TikTok API issues prevent actual publishing (the primary CTA post-render), users may not experience the value loop at all, making the upgrade irrelevant regardless of discount visibility.
[Full deep dive](../cycles/2026-07-03-cycle2/affiliate-system.md)


---

## Cycle #2 — 2026-07-03

Ship a closed-loop referral funnel in three layers: (1) Replace the bare redirect at `/ref/[handle]` with a personalized landing page that pulls the affiliate's name, platform, and avatar from the `affiliates` table and displays their discount code prominently with a 48-hour countdown timer seeded from a first-visit cookie. This alone removes the warm-trust evaporation that kills clicks. (2) At Stripe checkout session creation, auto-apply the referral discount as a Stripe Promotion Code — read `

**Confidence**: 8/10 | **Effort**: 4h
**Kill switch**: Affiliates don't have a uniform discount structure. If some affiliates offer 20% off, others 10%, others a free trial, others nothing at all, the 'auto-apply' logic has no single Stripe Coupon to attach and the personalized landing page shows inconsistent or empty discount fields. The Stripe integration also breaks if a referred user hits the paywall during an active site-wide promo or free trial — Stripe only allows one discount per checkout session. Additionally, if the `affiliates` table stores promo codes as human-typed strings (e.g. 'SAMY20') without a corresponding Stripe Promotion Code ID, auto-application requires a lookup/creation step that may fail silently and leave the user with a broken checkout. Verify affiliate DB schema and Stripe coupon coverage before shipping the Stripe layer.
[Full deep dive](../cycles/2026-07-03-cycle2/affiliate-system.md)


---

## Cycle #2 — 2026-07-03



**Confidence**: null/10 | **Effort**: nullh
**Kill switch**: N/A
[Full deep dive](../cycles/2026-07-03-cycle2/affiliate-system.md)
