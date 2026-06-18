# Fix: Auto-exposure correction for dark source footage

## Context
Source clips from Twitch streams (often filmed in dark rooms, cars at night, etc.) are rendered with zero brightness/exposure correction. The output is near-black and unwatchable. The pipeline needs an automatic exposure normalization step that detects underexposed footage and corrects it before compositing.

## Files to modify
- `src/render/pipeline.ts` (or main orchestration file) — add a new preprocessing step
- `src/render/filters/` — create `autoExposure.ts` or similar
- `src/render/config.ts` — add config for target brightness levels and thresholds
- FFmpeg filter chain or video processing module used by the renderer

## Steps
1. **Detect underexposure**: After source clip ingestion but before compositing, sample 5-10 evenly-spaced frames. Calculate average luminance (mean pixel brightness across Y channel). If average luminance < 40 (on 0-255 scale), flag as underexposed.
2. **Apply correction**: For underexposed clips, add an FFmpeg filter chain: `curves=preset=lighter` or `eq=brightness=0.4:contrast=1.3:gamma=1.8` (tune values). Alternatively use `-vf "curves=all='0/0 0.1/0.3 0.5/0.7 1/1'"` for a shadow-lift curve.
3. **Add shadow lift**: Apply a shadows/midtones lift that specifically targets the 0-60 IRE range without blowing out highlights.
4. **Expose as config**: Store target_avg_luminance (default: 90-110), max_brightness_boost (default: +3 stops), and enable/disable flag in render config.
5. **QC gate**: If after correction the average luminance is still < 30, mark the clip as `quality_warning: 'too_dark'` in metadata and surface a warning to the user: 'This clip is very dark — consider using a better-lit source.'
6. **Test**: Create a test with a known dark frame (avg luma 20) and assert post-correction luma is between 80-130. Create a test with a well-lit frame (avg luma 120) and assert no correction is applied.

## Definition of Done
- Dark source clips are automatically brightened to a watchable level
- Well-lit clips are not affected
- A QC warning is surfaced for clips that are too dark to salvage
- Unit tests for the luminance detection and correction filter
- Manual QA: render 2 dark source clips and confirm faces are visible in output

## Commit message
```
feat(render): add auto-exposure correction for underexposed source clips
```