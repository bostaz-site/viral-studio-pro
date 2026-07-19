# Lab Notes — landing-pages


---

## Cycle #1 — 2026-07-06

Replace the static hero on both `/` and `/invite` with a muted autoplay loop (8–12s, MP4+WebM, ≤2MB) showing a single continuous take: raw horizontal Twitch clip appears → vertical crop kicks in → karaoke captions animate word-by-word → TikTok export frame freezes. Pre-render 2–3 variants using the existing VPS pipeline (real clips from `trending_clips`, real captions from Whisper) and serve them as a `<video autoPlay muted loop playsInline>` in the hero — no JS framework needed, no live renderi

**Confidence**: 8/10 | **Effort**: 2.5h
**Kill switch**: The demo video backfires if: (1) The pre-rendered caption quality looks noticeably worse than the headline promises — visitors who came for 'polished TikTok output' see blocky or mistimed captions and leave with lower trust than if there had been no demo at all. (2) AUDIT_MODE is active and the TikTok export CTA in the video is visible but the feature is gated — creates expectation mismatch at the exact moment of signup. (3) The video loop stutters or fails to autoplay on iOS Safari (requires `playsInline muted` attributes AND a WebM fallback for Android) — on mobile, a broken video is worse than a static image. (4) The headline 'already found for you' conflicts with the Browse clips feature being hidden under AUDIT_MODE — the hero promises the core differentiator but new signups can't access it.
[Full deep dive](../cycles/2026-07-06-cycle1/landing-pages.md)
