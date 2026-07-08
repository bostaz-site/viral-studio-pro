# Fix: Remove 'coming soon' platforms from homepage

## Context
The landing page has a 'Post To' section (likely in `components/landing/` — look for platform logos/icons for TikTok, YouTube, Instagram) that shows YouTube and Instagram as 'soon'. Seven audit findings flag this as making the product feel half-built. The fix is to only show what's shipped.

## Requirements
1. Find the platform icons/logos section on the landing page.
2. Remove YouTube and Instagram entries entirely from the visible homepage section.
3. If there's a separate roadmap page or section, move the 'coming soon' platforms there. If not, add a small footnote or link: 'YouTube & Instagram support coming Q3 2025 — [join waitlist]' at the bottom of the pricing section or in the FAQ.
4. Ensure TikTok is presented confidently as THE supported platform with no ambiguity.
5. Clean up any related config arrays (e.g., `platforms = [{ name: 'TikTok', status: 'live' }, ...]`) so removed platforms don't leak back.

## Files likely involved
- `components/landing/platforms-section.tsx` or similar
- Any config file defining platform list

## Acceptance criteria
- The strings 'soon', 'coming soon' do not appear in the above-fold or mid-page platform section.
- Only TikTok is shown as a supported posting destination on the homepage.
- YouTube and Instagram references exist only in a clearly separated roadmap/FAQ context.