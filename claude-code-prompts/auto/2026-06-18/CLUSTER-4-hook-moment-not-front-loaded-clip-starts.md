# Fix: Front-load hook moment — smart clip in-point selection

## Context
Every rendered clip opens on dark, static, visually dead frames. The 'hook' — the most engaging visual moment — is buried mid-clip or never appears. Short-form content lives or dies in the first 0.5-1 second. The clip trimmer needs to detect and start at the peak-energy frame.

## Files to modify
- `src/render/clipSelector.ts` or `src/render/trimmer.ts` — the module that determines clip in/out points
- `src/render/analysis/hookDetector.ts` — create this module
- `src/render/pipeline.ts` — wire hook detection into the pre-render flow

## Steps
1. **Build a hook scoring function**: For each candidate frame in the source clip, compute a simple "engagement score" based on:
   - **Brightness**: average luminance (reject frames below threshold 40/255)
   - **Motion delta**: frame-to-frame pixel difference (higher = more action)
   - **Face presence**: use a lightweight face detector (e.g., MediaPipe or a pre-trained ONNX model) — frames with visible faces score higher
   - **Audio energy**: RMS amplitude of the corresponding audio segment — peaks in laughter/shouting score highest
2. **Select optimal in-point**: Find the frame with the highest composite score in the first 60% of the clip. Set the clip in-point to 0.5 seconds before that frame (to give a brief lead-in).
3. **Fallback**: If no frame scores above a minimum threshold, flag the clip as `low_hook_confidence` and warn the user: 'We couldn't find a strong hook moment — consider choosing a different clip.'
4. **Preserve out-point logic**: Keep existing clip duration / out-point logic unchanged.
5. **Test**: Given a 30-second clip where the first 10 seconds are dark and second 15 has a bright face + audio peak, assert the in-point is set within the 10-15 second range.

## Definition of Done
- Clip in-point is automatically set to the highest-energy frame
- Dark/static opening frames are trimmed away
- Clips with no good hook frame are flagged with a warning
- Integration test validates in-point selection on a sample clip
- Manual QA: render 3 clips and confirm each opens on a visually compelling frame

## Commit message
```
feat(render): add hook detection to auto-select engaging clip start frame
```