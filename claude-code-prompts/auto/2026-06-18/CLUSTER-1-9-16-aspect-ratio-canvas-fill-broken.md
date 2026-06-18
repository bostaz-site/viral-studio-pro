# Fix: 9:16 Aspect Ratio / Canvas Fill Broken

## Context
We are a video editing SaaS (viralanimal.com) that renders short-form vertical clips (1080x1920, 9:16) from source footage that is often landscape/horizontal (16:9). Our render pipeline currently places the source video into the vertical canvas using a "fit" or "contain" mode, which preserves the full source frame but creates massive black bars above and below (letterboxing). In 18 out of 50 audit findings, the rendered output has 60-70% dead black space, making clips unusable for TikTok/Reels/Shorts.

## Root Cause
The video compositor's canvas fit mode defaults to `contain` (fit entire source within canvas) instead of `cover` (scale source to fill entire canvas, cropping overflow). There is no smart-reframe or face-tracking crop applied.

## Requirements
1. **Change default canvas fit mode to `cover`/`fill`**: In the render pipeline's video compositor (likely `video_compositor.ts` or similar), change the scaling logic so the source clip is scaled up to completely fill the 1080x1920 canvas. Overflow is cropped.
2. **Implement center-crop with face detection bias**: When cropping overflow, default to center-crop. If a face detection model is available (or can be added via a lightweight library), bias the crop region toward detected faces so subjects stay visible.
3. **Add blurred background fill as fallback**: If the source aspect ratio is extremely mismatched (e.g., ultra-wide 21:9), layer a scaled+blurred copy of the source footage behind the main clip to fill any remaining gaps, rather than showing black.
4. **Eliminate all black bars**: Add a post-composition validation step that checks if any edge region of the output frame is solid black (< 5% luminance across > 10% of frame height/width). If detected, log a warning and re-trigger the fill logic.
5. **Never export with letterboxing for short-form outputs**: Add an assertion/guard in the export path that rejects frames where the content bounding box occupies less than 85% of the canvas area.

## Files to investigate
- Look for the video compositor, canvas layout, or aspect ratio handler (search for `contain`, `fit`, `letterbox`, `aspect`, `canvas`, `scale` in the codebase)
- Look for the render pipeline entry point and the crop/scale transform stage
- Look for any `background: black` or `fillStyle: '#000'` in canvas rendering code

## Testing
- Render a 16:9 landscape clip and verify the output fills the full 1080x1920 frame with zero black bars
- Render a 4:3 clip and verify same
- Render a clip with a face and verify the face is visible and roughly centered
- Render an ultra-wide clip and verify blurred background fill is applied
