# Fix: Remove unbuilt platform integrations from homepage

## Context
The homepage shows TikTok, YouTube (soon), and Instagram (soon) in a "Post To" platform strip. Only TikTok works. Five separate audit findings flag this as credibility-damaging vaporware signaling. We need to remove the unbuilt platforms from the main feature presentation and optionally add a separate, clearly-labeled roadmap signal.

## Files to modify
- Find the component rendering the platform logos strip on the landing page (likely in `components/landing/` — search for 'YouTube', 'Instagram', 'soon', or 'Post To')
- Also check the pricing section for any 'multi-platform distribution' claims tied to unbuilt features

## Requirements
1. Remove YouTube and Instagram logos/icons from the main platform integration strip entirely
2. If there's a 'multi-platform distribution' claim in pricing tiers, reword it to 'TikTok publishing (YouTube & Instagram coming Q3 2025)' or similar with a concrete timeframe
3. Optionally, add a small roadmap link below the TikTok logo: 'More platforms coming soon → Join waitlist' that links to a simple email capture or roadmap page
4. Search the entire landing page for any other references to YouTube or Instagram publishing as if it's a current feature, and either remove or clearly qualify them
5. Update the hero/subheading platform strip so it reads as complete with TikTok alone — e.g., 'Publish directly to TikTok'

## Validation
- Visually confirm the homepage no longer shows YouTube or Instagram as current capabilities
- Ensure no 'soon' badges remain in the main feature flow
- Grep for 'soon' in landing page components to catch any stragglers