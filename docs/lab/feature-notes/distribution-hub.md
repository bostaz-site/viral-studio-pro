# Lab Notes — distribution-hub


---

## Cycle #1 — 2026-07-03

Ship 'Zero-Decision Publish' as a two-part change. Part 1 (dialog pre-fill): When UnifiedPublishDialog auto-opens on render completion, it arrives fully populated from existing data — caption from distribution_settings.caption_template with {title} interpolated, hashtags from distribution_settings.default_hashtags (or niche presets from /api/distribution/optimize), and a single pre-selected slot computed from distribution_settings.optimal_hours + anti-shadowban spacing. The primary CTA reads 'Qu

**Confidence**: 8/10 | **Effort**: 4h
**Kill switch**: New users (the highest-value convert target) have no distribution_settings — no caption_template, no default_hashtags, no optimal_hours. The 'pre-filled' dialog opens empty or with placeholder text. The AI caption generation also fails if no transcription exists (user uploaded a clip without going through the full enhance flow, or Whisper failed silently). Result: the dialog looks broken, not frictionless. The new user sees an empty form at the payoff moment — worse than the current experience because it creates false expectation. Secondary scenario: if the parallel Haiku call races and arrives *after* the dialog opens (render faster than expected on short clips), the pre-fill flash-updates from empty → filled, which feels glitchy. Both failure modes hit new users disproportionately.
[Full deep dive](../cycles/2026-07-03-cycle1/distribution-hub.md)
