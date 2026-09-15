# DoD Report — Hook text fallback post-Whisper (2026-09-15)

## Problem

Render e7cf778e: TRANSFORM SCORE 2/3, "no hook text available" despite Whisper returning 155 words. Title "frgg" too short for title-based fallback. The hook text was only generated if the frontend provided it; the VPS had no post-Whisper fallback path.

## Changes

### 1. Hook fallback post-Whisper (`vps/routes/render.js`)

After Whisper completes and timestamps are synced, if `settings.hook.enabled && settings.hook.textEnabled !== false && !settings.hook.text && wordTimestamps.length > 0`:
- Run `detectPeakMoment()` on the Whisper transcript
- Call `generateHookPackage()` with transcript, peakTranscript, title, streamer, niche, mood, feedCategory
- Pick hook matching `settings.hook.style`, else `hooks[0]`
- Assign `settings.hook.text` and `settings.hook.color`
- Log `HOOK FALLBACK (post-Whisper): <text>`

This runs BEFORE the contract records `hook_text` and BEFORE the FFmpeg render config is built, so the overlay generation picks up the text.

### 2. Crop advisor stderr logging (`vps/lib/crop-advisor.js`)

Replaced truncated 200-char stderr with full stderr output + command + exit code for easier debugging.

### 3. Dockerfile — python3 + opencv

Already installed: `python3`, `python3-pip`, `opencv-python-headless==4.10.0.84`, `numpy`, `libglib2.0-0`, `libgl1-mesa-glx`. Haar cascade verified at build time. No changes needed.

## Verification

- `node --check vps/routes/render.js` — PASS
- `cd vps && node test-build-args.mjs` — PASS (no TDZ)
- `/render-test 53fcd703-bd8a-4b7e-b300-7f8a79e90527` — NOT VERIFIED (requires VPS deploy)

## Status

| Check | Result |
|---|---|
| Syntax check render.js | DONE |
| Syntax check crop-advisor.js | DONE |
| Smoke test (TDZ) | DONE |
| Render test clip 53fcd703 | NOT VERIFIED — needs deploy to Railway |
