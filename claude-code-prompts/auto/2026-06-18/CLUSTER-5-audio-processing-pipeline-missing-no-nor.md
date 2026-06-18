# Fix: Audio Processing Pipeline Missing

## Context
Multiple audit findings flag that audio quality is likely poor due to source recording conditions (car interiors, mobile captures, Twitch streams) and no audio processing is being applied. The render pipeline passes raw audio through without normalization, noise reduction, or EQ.

## Root Cause
The render pipeline has no audio processing stage. Raw source audio is composited directly into the output without any enhancement.

## Requirements
1. **Add audio normalization**: Normalize all output audio to -14 LUFS (the standard for mobile/social playback). Use loudnorm filter in FFmpeg or equivalent.
2. **Add noise reduction**: Apply a noise gate and/or spectral noise reduction pass. For FFmpeg, use `afftdn` or `anlmdn` filters. Target removing steady-state noise (road noise, fan hum, stream compression artifacts).
3. **Add vocal EQ boost**: Apply a gentle EQ boost to the 1kHz-4kHz range to improve voice clarity on mobile speakers.
4. **Add audio level validation**: After processing, verify peak levels are below -1dBFS (no clipping) and average loudness is within -16 to -12 LUFS range.
5. **Add background music bed option**: Allow users to add a background music track at -20dB under dialogue. Pre-load 5-10 royalty-free tracks as defaults.

## Files to investigate
- Render pipeline audio stage (search for `audio`, `ffmpeg`, `normalize`, `lufs`, `noise`)
- FFmpeg command builder or audio filter chain
- Output export configuration

## Testing
- Upload a clip with road noise and verify output has reduced noise and clear vocals
- Upload a quiet clip and verify it's normalized to audible levels
- Verify no clipping on a clip with loud peaks
