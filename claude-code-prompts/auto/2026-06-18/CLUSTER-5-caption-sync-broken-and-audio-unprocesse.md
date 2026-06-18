# Fix: Audio preprocessing + caption sync pipeline

## Context
Captions appear in only some frames, are mistimed, and sometimes include non-speech artifacts (numbers, metadata). Source audio from Twitch clips (car interiors, noisy streams) receives zero processing — no noise reduction, no normalization, no speech enhancement. The ASR step runs on raw, noisy audio, producing poor transcripts with bad timestamps, which cascades into broken caption sync.

## Files to modify
- `src/render/audio/processor.ts` — create or enhance the audio preprocessing module
- `src/render/captions/sync.ts` — the caption timing/alignment module
- `src/render/captions/generator.ts` — the ASR invocation module
- `src/render/captions/renderer.ts` — caption styling and positioning
- `src/render/pipeline.ts` — wire audio preprocessing before ASR
- FFmpeg filter chain configuration

## Steps
1. **Audio preprocessing** (before ASR):
   - Apply noise reduction via FFmpeg `afftdn` or `arnndn` filter
   - Apply speech EQ: boost 1kHz-4kHz by +3dB, cut below 80Hz
   - Normalize to -14 LUFS using `loudnorm` filter
   - Export cleaned audio as a separate track for ASR input
2. **Improve ASR call**: Pass the cleaned audio (not raw source) to the ASR service. Request **word-level timestamps** (not sentence-level). If using Whisper, use `word_timestamps=True`. If using another provider, enable equivalent.
3. **Caption sync**: Align each caption segment to its word-level timestamps. Ensure captions appear within 100ms of speech onset and disappear within 200ms of speech offset. Filter out non-speech detections (numbers, metadata, chat text) by adding a heuristic: reject segments that are pure numbers or < 2 characters.
4. **Caption styling**: Set default position to center-bottom of the **video content area** (not the canvas). Font size minimum 48px, bold white with 3px black stroke or semi-transparent background pill. Ensure captions stay within platform safe zones (not overlapping bottom 15% where platform UI lives).
5. **Background music**: Add a config option to layer royalty-free background music at -18dB under dialogue. Default to off but surface as a toggle in the UI.
6. **Test**: Given a noisy audio file, assert post-processing LUFS is within -16 to -12. Given a transcript with word timestamps, assert every caption appears within 150ms of its audio timestamp.

## Definition of Done
- Source audio is cleaned (noise-reduced, EQ'd, normalized) before ASR
- Captions appear on every spoken word with accurate timing (±150ms)
- Non-speech artifacts filtered out of caption track
- Captions styled with high contrast and positioned in safe zone
- Audio output normalized to -14 LUFS
- Tests for audio processing and caption sync accuracy

## Commit message
```
feat(render): add audio preprocessing pipeline and fix word-level caption sync
```