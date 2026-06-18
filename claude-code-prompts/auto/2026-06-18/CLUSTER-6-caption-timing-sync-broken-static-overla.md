# Fix: Caption Timing/Sync Broken — Static Overlays Instead of Word-Synced Captions

## Context
Captions in our rendered clips appear to be static overlays rather than dynamically timed to speech. In some keyframes captions are present, in others they're absent, and the hook text ('I'M LITERALLY DEAD') remains frozen across all frames instead of being timed to a specific moment. Modern short-form content uses word-level caption animation (like CapCut/Captions.ai style) where each word appears in sync with speech.

## What to Fix
Replace the static caption overlay system with properly timed, word-level caption rendering.

## Requirements
1. **Generate word-level timestamps from STT**: Ensure the speech-to-text pipeline outputs word-level timestamps, not just sentence-level. If using Whisper, use `word_timestamps=True`. If using Deepgram, use the `utterances` + `words` response fields.
2. **Render captions using word-level timing**: Each caption segment should appear on screen only when the corresponding words are being spoken and disappear when the segment ends. Standard approach: show 3-5 words at a time, timed to speech boundaries.
3. **Add word highlight animation**: The current active word should be visually highlighted (bold, different color, scale pop) while surrounding words remain neutral. This is the standard TikTok/Reels caption style.
4. **Hook text timing**: The hook text overlay (e.g., 'I'M LITERALLY DEAD') should appear for only the first 1.5-2 seconds, not persist for the entire clip. It should animate in (fade or pop) and animate out.
5. **Caption styling**: Ensure captions have sufficient contrast against any background — use a dark text stroke (2-3px), drop shadow, or semi-transparent background pill. Font size should be at least 48-56pt for mobile readability.
6. **Validate sync post-render**: Sample 3-5 random timestamps from the SRT and verify the corresponding frame has the correct caption text visible.

## Files likely involved
- Caption rendering module (where SRT/VTT is parsed and burned into video)
- STT/transcription module (where timestamps are generated)
- Overlay/text rendering code (ffmpeg `drawtext` filter or canvas-based text rendering)

## Validation
- Render a clip with known speech and verify captions appear/disappear in sync with words
- Verify the hook text is not static for the entire duration
- Verify caption styling is readable on a mobile screen (screenshot at 1080x1920)