# Fix: Replace Vague Social Proof with Real Evidence and Output Samples

## Context
The hero section contains `Trusted by clippers and creators turning stream moments into TikTok hits` — a generic claim with no numbers, no creator names, and no real clip output. The Before/After feature comparison uses a static phone-frame mockup instead of actual rendered footage. With only 9 users, the social proof is actively harmful because visitors can tell it's unsubstantiated.

## Requirements

### 1. Hero Social Proof Line
- **If user count is < 50:** Replace the generic line with an honest early-access framing: `Join [X] early creators in beta — free forever for founding members` or simply remove the line entirely.
- **If user count is >= 50:** Replace with a concrete stat: `Used by X creators · Y clips published` pulling from real database counts.
- Never use vague `Trusted by...` copy without evidence.

### 2. Before/After Feature Section
- Replace the static phone-frame mockup in the `After — Viral Animal` panel with an actual autoplaying muted MP4/WebM video of a real rendered 9:16 TikTok clip.
- The video should loop, autoplay, be muted by default, and show a real stream-to-clip transformation.
- If no real clip is available yet, create one using the product and record the output.
- Keep the Before panel as-is (raw stream screenshot is fine for contrast).

### 3. Optional Quick Win
- Below the hero, add 2-3 small avatar circles with creator handles (even if they're the founding team's test accounts) to give a human signal. Remove once real testimonials are available.

## Files to Investigate
- `components/landing/hero-section.tsx`
- `components/landing/features-section.tsx` (Before/After comparison)
- Public assets directory for video/image hosting