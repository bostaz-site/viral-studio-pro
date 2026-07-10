# Fix: Remove or Properly De-emphasize 'Coming Soon' Platform Logos

## Context
11 audit findings flag the same issue: the 'Post To' section shows TikTok, YouTube ('soon'), and Instagram ('soon') logos at roughly equal visual weight. This makes the product look half-built and reads as vaporware to skeptical visitors. The fix is to lead with what works (TikTok) and either remove or drastically de-emphasize unshipped platforms.

## Requirements
1. Find the platform logos / 'Post To' section component (likely in `components/landing/` — search for 'YouTube', 'Instagram', 'soon', or 'platform').
2. **Option A (preferred):** Remove YouTube and Instagram logos entirely from this section. Add a small text footnote or a separate 'Roadmap' link: 'YouTube Shorts & Instagram Reels coming Q3 2025.'
3. **Option B (if stakeholder insists on showing them):** Reduce opacity of coming-soon platforms to 30%, move them after TikTok with clear visual separation, and replace the tiny 'soon' text with a prominent 'Coming Soon' pill badge.
4. Ensure the TikTok logo stands alone as the primary, confident platform statement.
5. If the Studio pricing tier mentions 'multi-platform distribution', add a qualifier '(TikTok today, more platforms coming soon)' to avoid false advertising.

## Files likely involved
- `components/landing/platform-section.tsx` (or equivalent — search for platform logo references)
- Possibly `components/landing/pricing-section.tsx` if Studio tier copy mentions multi-platform

## Acceptance Criteria
- The homepage 'Post To' section no longer shows YouTube and Instagram at equal visual weight to TikTok.
- Unshipped platforms are either removed or visually distinct (30% opacity + clear 'Coming Soon' badge).
- No misleading multi-platform claims remain in pricing or feature copy.