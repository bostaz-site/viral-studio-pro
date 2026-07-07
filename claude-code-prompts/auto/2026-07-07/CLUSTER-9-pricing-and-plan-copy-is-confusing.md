# Fix: Clarify Pricing Copy and Hero Scope

## Context
The Studio plan card uses confusing copy like '90 + 30 bonus' instead of simply '120 clips/month', and shows an unexplained crossed-out price (finding 113). Meanwhile, the homepage hero says 'Your Twitch Clip' but the tool also supports YouTube Gaming, underselling its scope (finding 121). Both are copywriting clarity issues affecting acquisition.

## Task
### Pricing Card Fix (Finding 113)
1. Find the pricing section component (likely `components/landing/pricing-section.tsx` based on the finding).
2. Simplify Studio plan headline: Change '120 videos/month (90 + 30 bonus)' to just '120 videos/month'.
3. Add a value anchor line: 'That's 4× more clips for just $5/mo extra vs Pro' or similar comparative copy.
4. Either explain the crossed-out $29 price ('Launch discount — normally $29/mo') or remove it if there's no real discount program.
5. Consider adding a 'Best Value' or 'Most clips per dollar' badge to Studio, differentiating it from Pro's 'Most Popular' badge.

### Hero Scope Fix (Finding 121)
6. Find the hero section component and update:
   - Change 'Your Twitch Clip, Made Viral' → 'Your Stream Clip, Made Viral' (or 'Your Best Stream Moments, Made Viral')
   - Change 'Built by streamers, for streamers' sub-badge to include platform scope: 'Works with Twitch & YouTube Gaming'
   - Ensure the 'Works With' logo section below is consistent with this broadened hero copy.

## Acceptance Criteria
- Studio plan card says '120 videos/month' with no confusing breakdown
- Value comparison to Pro plan is visible on the Studio card
- Crossed-out price has context or is removed
- Hero headline is platform-inclusive, not Twitch-only
- Sub-badge or sub-line mentions supported platforms