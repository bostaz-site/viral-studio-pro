# Lab Notes — billing-stripe


---

## Cycle #1 — 2026-07-02

Combine the strongest elements of both councils into a two-surface approach. Surface 1: Add a persistent quota progress bar to the dashboard header ('2 / 3 clips used this month') using shadcn Progress, linking to pricing — proactive awareness with zero friction, catches users before the wall. Surface 2: When a free user's render completes, inject a 'Clean Export Paywall' state into the existing UnifiedPublishDialog (which already auto-opens post-render) — show their watermarked rendered output 

**Confidence**: 8/10 | **Effort**: 3h
**Kill switch**: Free users have a quota of 3 videos/month. If the typical free user reaches the render-completion paywall only once or twice before churning (never hitting quota wall), AND the side-by-side preview reads as manipulative rather than informative (dark pattern perception), it could generate negative App Store / TikTok review mentions that hurt organic acquisition more than the conversion lift is worth. A second risk: if conversion rate on the render-completion paywall is < 2%, the presence of the modal may increase publish-flow abandonment for free users (they close the dialog and don't post), reducing the virality loop that drives free-user acquisition in the first place.
[Full deep dive](../cycles/2026-07-02-cycle1/billing-stripe.md)
