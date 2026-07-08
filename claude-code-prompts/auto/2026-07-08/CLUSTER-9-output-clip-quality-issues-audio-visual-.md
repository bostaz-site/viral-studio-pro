# Fix: Improve clip output quality (audio, visual composition, hook timing)

## Context
Three findings flag that rendered clips have raw stream quality issues: unprocessed audio (no normalization, no noise gate), visible Twitch UI overlays (chat, HUD, scoreboards) cluttering the frame, and the emotional peak buried seconds into the clip instead of front-loaded. These are rendering pipeline issues, not UI issues.

## Requirements

### 1. Audio post-processing
In the clip rendering/export pipeline (likely a server-side FFmpeg or similar process):
- Apply a noise gate to reduce background hum.
- Apply EQ boost in the 2-5kHz presence range for voice clarity.
- Normalize output to -14 LUFS integrated (platform standard for TikTok/YouTube Shorts).
- Optionally add a subtle ambient music bed at -18dB (make this a toggleable option in the UI).

### 2. Visual composition / overlay cleanup
- During the crop/resize stage, detect and optionally mask or blur stream UI elements (chat overlays, HUD elements) in the periphery.
- If AI-based detection isn't feasible now, provide a manual crop adjustment UI where users can drag crop boundaries.
- Add this as a TODO/feature flag if full implementation is complex.

### 3. Hook timing optimization
- In the clip selection/trim AI logic, add a heuristic or prompt adjustment that prioritizes placing the highest-energy frame (peak reaction, peak action) within the first 2 seconds.
- Consider a 'flash-forward' option: 0.5s preview of the peak moment at the start, then context.
- If using an LLM for clip selection, add to the system prompt: 'The first 2 seconds must contain the most visually dramatic or emotionally intense moment.'

## Files likely involved
- Server-side rendering pipeline (likely `lib/video/`, `services/render/`, or an external worker)
- FFmpeg command construction
- Clip selection/AI prompt configuration

## Acceptance criteria
- Exported clips have normalized audio at -14 LUFS.
- A noise gate is applied to all stream-sourced audio.
- The clip trim logic prioritizes emotional peaks in the first 2 seconds (verifiable by reviewing 5 test clips).
- Visual overlay cleanup is at minimum documented as a roadmap item with a feature flag.