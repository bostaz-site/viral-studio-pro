# Fix: Hook Moment Not Front-Loaded — Wrong Clip Trim Points

## Context
Our pipeline takes source VODs/streams and trims them into short-form clips. Currently, the clip trimming logic selects in-points that result in clips opening with dead, dark, unengaging footage. The actual funny/surprising/engaging moment is buried seconds into the clip. For short-form content (TikTok/Reels/Shorts), the first 0.5-1 second determines whether a viewer keeps watching. 13 findings flagged this as critical.

## What to Fix
Implement a "hook detection" and "hook-first" editing strategy in the clip trimming stage.

## Requirements
1. **Implement peak moment detection**: After identifying a clip's rough boundaries, analyze the clip to find the "peak moment" — the frame/second with the highest engagement signal. Signals to use (in priority order):
   - **Audio energy spike**: Detect sudden volume increases (laughter, shouting, gasps) using RMS energy analysis on the audio waveform. The moment with the highest dB spike relative to the surrounding 2-second window is likely the peak.
   - **Face expression intensity**: If face detection is available, look for frames with the widest mouth opening, most extreme facial expressions (surprise, laughter).
   - **Chat activity spike**: If Twitch chat data is available, correlate with moments of highest chat message frequency.
   - **Motion/scene change**: Detect sudden visual changes using frame differencing.
2. **Trim the clip to start 0.5-1 second before the peak moment**, not at the original in-point. The peak reaction should land within the first 1-2 seconds of the output clip.
3. **If context is needed before the peak**: Use a "flash-forward" technique — show 0.5-1 second of the peak moment first (as a cold open), then cut to a brief setup (2-4 seconds), then play through the peak again. This is a proven short-form editing pattern.
4. **Add a hook quality score**: After trimming, compute a "hook score" for the first 2 seconds of the output clip based on: brightness (is the frame visible?), motion (is something happening?), face presence (is a face visible?), audio energy (is there speech/laughter?). If the score is below a threshold, flag for re-trimming or rejection.
5. **Never start a clip with**: pure black frames, silence, static title cards with no action behind them, or footage where no face/subject is visible.
6. **Add the hook score to render metadata** so it can be tracked and used for quality filtering.

## Implementation approach
- Use ffmpeg + Python for audio RMS analysis: extract audio, compute RMS in sliding windows, find peaks
- Use a simple frame brightness check (average pixel value) on the first 5 frames to catch "starts with black" cases
- This doesn't need to be perfect ML — even simple heuristics (loudest moment = hook) will be a massive improvement over the current behavior

## Files likely involved
- Clip selection/trimming module (likely called `clip_selector`, `clip_trimmer`, `highlight_detector`, or similar)
- The function that determines in-point and out-point timecodes for each clip
- Render pipeline where clips are assembled

## Validation
- Process a known Twitch clip where the funny moment is at 8 seconds in — confirm the output starts at ~7-7.5 seconds
- Confirm the hook score for the re-trimmed clip is higher than the original
- Confirm clips no longer open with pure-black or static frames