# Fix: Video not scaled to fill 9:16 canvas

## Context
The render pipeline composites source clips (typically 16:9 Twitch VODs / webcam feeds) into a 9:16 output canvas using a **fit/letterbox** strategy. This leaves 60-70% of the frame as dead black space. Every single rendered clip exhibits this. The fix must change the default canvas-fit mode to **cover/crop-to-fill** with face-tracking centering.

## Files to modify
- `src/render/compositor.ts` (or equivalent — the module that positions the source video layer onto the output canvas)
- `src/render/config.ts` or `src/render/templates/*.json` — any template or config that sets `objectFit`, `scalingMode`, `canvasFit`, or equivalent
- `src/render/reframe.ts` — if a smart-reframe / auto-crop module exists, ensure it is enabled by default

## Steps
1. Find the canvas composition logic where the source clip is placed onto the 1080×1920 output. Search for keywords: `fit`, `contain`, `letterbox`, `objectFit`, `scale`, `aspectRatio`, `canvas`.
2. Change the default fit mode from `contain` / `fit` to `cover` / `fill`. The source video must be scaled up so its **smaller dimension** matches the corresponding canvas dimension, then cropped on the larger dimension.
3. Default the crop anchor to **center-center**. If a face-detection or subject-tracking module exists (`reframe`, `autoReframe`, `faceTrack`), enable it so the crop follows the primary subject.
4. If no face-tracking exists, add a TODO but default to center-crop for now.
5. Add a blurred-background fallback: if the source aspect ratio is wider than 4:3 (extremely wide), render a scaled+blurred copy of the source behind the main layer so no black bars ever appear.
6. Add a unit test: given a 1920×1080 source and a 1080×1920 canvas, assert the output video layer dimensions are ≥1080 wide AND ≥1920 tall, and that no pixel row in the output is solid black unless it comes from the source content itself.
7. Add an integration test: render a sample 16:9 clip and assert <5% of the output frame area is letterbox black.

## Definition of Done
- All rendered clips fill 100% of the 9:16 canvas with zero black letterbox bars
- Source content is center-cropped (or face-tracked) to fill the frame
- Existing clip templates updated to use `cover` mode
- Unit + integration tests pass
- Manual QA: render 3 sample clips of varying aspect ratios (16:9, 4:3, 1:1) and confirm full-bleed output

## Commit message
```
fix(render): change canvas fit from contain to cover — eliminate black letterbox bars on 9:16 output
```