# Fix: Remove 'Soon' Platforms from Homepage

## Context
The homepage has a 'Post To' platform section that lists YouTube and Instagram with 'soon' labels alongside TikTok. This appears in multiple audit findings (100, 106, 110, 120) because it makes the product feel incomplete and undermines trust. The root cause is a single component rendering unshipped platforms in a marketing-critical section.

## Task
1. Find the component that renders the platform logos/icons section on the landing page (likely in `components/landing/` — look for references to 'YouTube', 'Instagram', 'soon', or a platforms array).
2. Remove YouTube and Instagram entries from this section entirely — do NOT just hide them with CSS.
3. If there's a config array of platforms, add a `shipped: boolean` field and filter to only show `shipped: true` platforms in the homepage section.
4. Add a small footnote or link below the TikTok logo: 'More platforms coming — see our roadmap' that links to `/roadmap` (or `#` as placeholder).
5. Ensure the hero/step-1 area now confidently leads with TikTok as the single shipped destination.
6. Search the entire codebase for any other 'soon' platform references in marketing copy and remove them.

## Acceptance Criteria
- Homepage platform section shows only TikTok with no 'soon' labels anywhere visible
- A subtle roadmap link exists for users who want to know about future platforms
- No visual regression in the platform section layout