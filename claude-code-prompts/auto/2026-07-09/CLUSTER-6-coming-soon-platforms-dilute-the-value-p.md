# Fix: De-emphasize 'Coming Soon' Platforms on Landing Page

## Context
5 findings (123, 124, 137, 139, 146) report that showing YouTube and Instagram as 'Soon' next to TikTok makes the product feel incomplete and half-baked. The core product only supports TikTok, but the prominent placement of unshipped platforms creates confusion and undermines confidence.

## Task

### 1. Find the platform logos section
- Locate the component that renders the 'Post To' platform icons (likely in the landing page components, around the features/how-it-works section).

### 2. De-emphasize or remove 'coming soon' platforms
- **Preferred approach**: Remove YouTube and Instagram logos from this section entirely. Keep only TikTok as the featured platform. Add them back when they actually launch.
- **Alternative approach** (if product/marketing insists on showing them): 
  - Reduce opacity of YouTube and Instagram logos to 30%.
  - Move them after TikTok with clear visual separation.
  - Replace the small grey 'soon' text with a more visible `Coming Q3 2025` pill badge.
  - Ensure TikTok is visually dominant (larger, full opacity, possibly with a checkmark or 'Live' badge).

### 3. Update surrounding copy
- If the section headline references multi-platform posting, narrow it to: 'Post directly to TikTok' or 'Built for TikTok clippers'.
- If you keep coming-soon platforms, add a link: 'See our roadmap →' pointing to a changelog or roadmap page.

## Acceptance Criteria
- TikTok is the only prominently displayed platform, OR coming-soon platforms are visually distinct and clearly secondary.
- No visitor can reasonably mistake the product for supporting YouTube/Instagram today.
- Copy in the section accurately reflects current capabilities.