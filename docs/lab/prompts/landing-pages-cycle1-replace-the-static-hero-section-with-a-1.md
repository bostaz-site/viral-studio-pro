# Lab Prompt — landing-pages (cycle #1)

> Auto-generated from Lab deep dive on 2026-06-19

## Target Metric
**landing_signup_rate** — minimum delta: 5

Measurement: COUNT(auth.users created WHERE referrer LIKE '%viralanimal.com%' OR utm_source='landing') / COUNT(unique sessions on '/') over 7d rolling window — tracked via Supabase auth events + analytics pageview events

## Final Recommendation
Replace the static hero section with a 15-second auto-playing, muted, looping side-by-side video demo: left panel shows a raw 16:9 Twitch clip (no treatment), right panel shows the Viral Animal output (9:16 vertical, karaoke captions, Subway Surfers split-screen, viral score badge). The video loads lazily but starts immediately on viewport entry. The hero headline and primary CTA are overlaid on top of the video — not above it — so the product demonstrates its value before the user reads a single word. The two panels should be slightly asymmetric: raw clip takes 40% width, output takes 60% width, making the 'after' state visually dominant. Collapse all existing CTAs (Try for Free / Upload your own clip / Watch Demo) into a single primary button: 'Start Free — No Card Required'. This button appears 3 times: overlaid on the hero video, after the Before/After section, and in the footer CTA section. Add one social proof line directly below the first CTA button (real numbers only — do not fabricate). A visible unmute icon sits at the bottom-right of the video panel so users can opt in to audio without blocking the autoplay. Implement as a next/video or HTML5 video with poster fallback for slow connections. Lazy-load via IntersectionObserver to protect Core Web Vitals — the video should not block LCP.

## Rationale
Both councils converge with high confidence on the core insight: the #1 conversion blocker is opaque output quality, and a 15s looping before/after video is the single highest-leverage fix. The intuition pointed in the right direction (visual proof > copywriting) but was too vague about layout and CTA consolidation. The councils added specificity: split-screen layout with asymmetric weighting toward 'after', the exact CTA text, and the competitive framing (Opus Clip). Overlaying the headline on the video (Sonnet's approach) is chosen over separating them (Opus's approach) because it reduces scroll depth to value — the user sees product + pitch simultaneously. CTA consolidation from 3 to 1 eliminates decision paralysis, which is a well-documented friction point in SaaS landing pages.

## Kill Switch — MUST ADDRESS (severity 9/10)
The production before/after clip does not exist or is low quality. If the team cannot produce a genuinely impressive 15-second transformation — one where a non-creator immediately says 'oh that's way better' — then the video demo actively destroys trust instead of building it. A mediocre output (bad caption timing, generic gameplay footage, ugly overlay) makes the product look weak at exactly the moment it needs to prove itself. Secondary kill switch: video autoplay blocked by browser policy on mobile (iOS Safari) or network policy (corporate WiFi), causing a broken blank hero with no fallback, which tanks mobile conversion. Third kill switch: the social proof numbers are not real — if called out by a creator community (Twitter/Discord), the fake stat becomes a viral negative signal that is harder to undo than the signup lift was worth.

**Before implementing, verify this won't happen. Add safeguards.**

## Alternatives Rejected (do NOT implement these)
- Keep static before/after mockup but improve it with higher-fidelity screenshots and animated caption preview: Static images cannot demonstrate karaoke caption timing, which is the product's core differentiator. Creators need to see captions moving to trust that they look good. Static fidelity improvements are low-leverage.
- Add a full interactive demo (upload a clip directly from the landing page, process it, show result): High engineering cost (4-6x this recommendation), introduces a render pipeline dependency on landing page load, and risks showing a slow or failed render to a new user. The conversion risk is too high for a first impression.
- Replace hero with a short-form video testimonial from a real creator showing their results: Social proof testimonials are credible but require a creator who has already gotten strong results. Without an existing creator base with documented wins, this cannot be executed now and would require fabrication. The before/after product demo is self-contained and does not depend on external social proof.

## Effort
~2h with Claude Code (10h human estimate)

## Confidence: 8/10

## Definition of Done
- [ ] All changes from "Final Recommendation" implemented
- [ ] Kill Switch concern addressed with safeguards
- [ ] Build passes (`npm run build`)
- [ ] Commit: `feat(landing-pages): lab cycle 1`
- [ ] Push to origin
