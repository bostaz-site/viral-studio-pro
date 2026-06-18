# Fix: No Exposure/Brightness Correction on Dark Source Footage

## Context
Our video rendering pipeline produces clips that are frequently near-black and unwatchable. Source footage from Twitch streams often comes from dark environments (car interiors, night scenes, poorly lit rooms). The pipeline currently applies zero brightness/exposure correction, meaning these clips go out as-is. 13 out of 50 audit findings flagged this as a critical issue.

## What to Fix
Add an automatic brightness/exposure normalization step to the render pipeline that runs on every clip before final compositing and export.

## Requirements
1. **Add a luma analysis step** after source clip ingestion but before compositing. Sample 5-10 evenly-spaced frames from the clip and compute the average luminance (mean pixel brightness across Y channel in YUV, or mean of RGB).
2. **Define a brightness threshold**: If the average luma of sampled frames is below a configurable threshold (suggested: mean Y < 40 on a 0-255 scale), flag the clip as "underexposed" and apply correction.
3. **Apply automatic exposure correction** using ffmpeg filters:
   - Use the `curves` or `eq` filter to boost brightness and shadows: e.g., `eq=brightness=0.4:gamma=1.8` or `curves=preset=lighter`
   - Apply a shadow lift that targets the lower end of the histogram without blowing out highlights
   - Suggested ffmpeg filter chain: `eq=brightness=0.3:contrast=1.2:gamma=1.5,unsharp=5:5:0.5:5:5:0.5`
4. **Add a "reject" threshold**: If average luma is below 15 (essentially black), flag the clip as unrecoverable and mark it for replacement rather than attempting correction. Surface this to the user: "This clip is too dark to use. Try a different source."
5. **Make correction strength proportional to darkness**: Don't apply the same +60 brightness to a slightly dim clip as to a near-black one. Scale the correction based on how far below the target luma (suggested target: Y=100-120) the source falls.
6. **Add a post-correction validation**: After applying the brightness filter, re-sample frames and confirm the output luma is within an acceptable range (Y > 60). Log a warning if correction was insufficient.
7. **Audio parallel**: Also add a loudness normalization step if one doesn't exist — normalize audio to -14 LUFS using ffmpeg's `loudnorm` filter. Apply a basic noise reduction pass using `afftdn` for clips flagged as noisy.

## Files likely involved
- Render pipeline: look for where ffmpeg commands are constructed and source clips are processed
- Look for any existing color grading, filter chain, or post-processing step
- Configuration files where render quality settings are defined

## Validation
- Process a known dark clip (average Y < 30) through the pipeline and confirm the output has visible, recognizable subjects
- Confirm a well-lit clip (average Y > 100) passes through without over-brightening
- Confirm clips below the reject threshold are flagged, not silently rendered as black video