# Fix: Unify Plan State Display Across UI

## Context
The nav bar shows a 'STUDIO' badge regardless of actual plan, the usage counter shows studio-tier limits for what might be a free user, and the free tier pricing card doesn't clearly list what's included vs excluded (findings 115, 122). Users can't tell what plan they're on, which undermines upgrade decisions.

## Task
1. **Audit plan state sources**: Search the codebase for where the user's plan/tier is read (auth context, user object, subscription status). Identify if there's a single source of truth or multiple inconsistent checks.
2. **Create a `usePlanStatus` hook** (or equivalent) that returns: `{ plan: 'free' | 'pro' | 'studio', limits: { clips: number, ... }, usage: { clips: number, ... }, isActive: boolean }`. All UI components should read from this single hook.
3. **Fix the nav badge**: 
   - Free users: Show no badge, or a subtle 'FREE' badge with an 'Upgrade' link
   - Pro users: Show 'PRO' badge
   - Studio users: Show 'STUDIO' badge
   - The badge should be driven by `usePlanStatus().plan`
4. **Fix the usage counter**: Ensure the limit number (e.g., 120 vs 3 vs 30) comes from `usePlanStatus().limits.clips`, not a hardcoded value.
5. **Fix the pricing section free tier card** (on landing page): Add explicit feature lines to the Free plan:
   - '3 videos/month'
   - '9:16 format' (or whatever formats are actually included)
   - 'Standard rendering'
   - Make excluded features visible but greyed out so users can compare at a glance.

## Acceptance Criteria
- Nav badge accurately reflects the user's actual plan
- Usage counter limits match the user's actual plan
- All plan-aware UI reads from the same hook/context
- Free tier pricing card explicitly lists included and excluded features