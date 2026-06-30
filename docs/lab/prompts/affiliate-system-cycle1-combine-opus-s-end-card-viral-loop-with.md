# Lab Prompt — affiliate-system (cycle #1)

> Auto-generated from Lab deep dive on 2026-06-30

## Target Metric
**referral_conversion_count_monthly** — minimum delta: 5

Measurement: COUNT(referral_events WHERE event_type='conversion' AND created_at BETWEEN NOW()-30d AND NOW()) — tracked via existing referral_events table, event_type='conversion' row inserted on Stripe webhook after referred user upgrades to paid plan

## Final Recommendation
Combine Opus's end-card viral loop with Sonnet's attribution-aware checkout into a single cohesive system. On user signup, auto-create a row in `affiliate_codes` with a handle derived from username — zero friction, 100% coverage. Every free-tier export burns a 2-second end-card into the final MP4 via the FFmpeg pipeline: 'Made with Viral Animal · viralanimal.com/ref/[handle]' plus a QR code. This transforms every exported clip into a distribution event — the video itself is the referral vehicle, reaching exactly the audience most likely to want the product (people watching streamer clips). End-card is suppressed for Pro/Studio subscribers, making removal a tangible upgrade benefit.

When a viewer lands via /ref/[handle], persist the affiliate_id + a 20%-off promo code in a 30-day cookie and immediately show a sticky welcome banner. When that user hits any paywall or the export screen, pre-fill the promo code in Stripe checkout with 'Your 20% discount from [handle] is applied.' This closes the attribution gap Sonnet identified — the referred user never has to remember anything, and the discount surfaces exactly when purchase intent peaks.

On Stripe webhook (checkout.session.completed), attribute the conversion: increment affiliate_codes.conversions and total_earned, insert a referral_events row, and credit the referrer one free Pro render token (implementing the intuition's double-sided reward). The referral loop is now fully closed: export → end-card in video → new signup → cookie-aware checkout → conversion → referrer rewarded → referrer exports more.

## Rationale
The end-card mechanism is the highest-leverage element because it creates distribution without requiring the referrer to do anything active — the product distributes itself with every export. Sonnet's attribution fix is the highest-leverage conversion element because referred users who forget to apply a promo code simply don't convert. Neither alone closes the full loop: end-card without attribution fix leaks conversions; attribution fix without distribution has no new traffic to convert. The double-sided reward from intuition adds a second-order incentive (referrer is rewarded at the exact moment of maximum value delivery) but is tertiary — it amplifies an already-working loop rather than creating one.

## Kill Switch — MUST ADDRESS (severity 7/10)
Streamers and creators are pathologically anti-watermark. This audience specifically chose clips to post on TikTok/Reels/YouTube Shorts where a visible 'Made with Viral Animal' end-card signals amateur production quality and gets them skipped or mocked. If the target user base (aspiring viral creators who care about their brand) perceives the end-card as embarrassing rather than neutral, they will either (a) not export at all and abandon the product, (b) export but crop/trim the end-card away, or (c) never upgrade because they've worked around the watermark. The entire model collapses if the watermark creates more churn than it generates referrals. Secondary scenario: if the free tier already feels too restricted and the end-card is the tipping point of 'this isn't worth it,' conversion rates drop and the referral loop never gets seeded with enough exports to generate meaningful traffic.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Manual opt-in referral program (current passive promo code model): Attribution gap is fatal. Users who click a referral link and don't manually enter a promo code at checkout simply don't convert — the referrer gets no credit, the referred user gets no discount, and the incentive loop never closes. Passive systems get passive results.
- Double-sided free render reward at first export (raw intuition, standalone): This is a second-order incentive with no distribution mechanism. It rewards referrers after conversion but does nothing to generate new referral traffic. You need the end-card to create traffic and the attribution cookie to convert it — the reward alone amplifies a loop that doesn't exist yet.
- Email-based referral nudge post-export ('Share your clip and earn credits'): Adds a manual step in a flow that should be automatic. Users who export a clip are in a high-momentum moment; an email 24 hours later has 10x lower intent. The end-card embeds the referral directly in the artifact being shared, reaching a cold audience at scale without relying on the referrer to remember to share.

## Effort
~5.6h with Claude Code (28h human estimate)

## Confidence: 7/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(affiliate-system): lab cycle 1`
- [ ] Push to origin
