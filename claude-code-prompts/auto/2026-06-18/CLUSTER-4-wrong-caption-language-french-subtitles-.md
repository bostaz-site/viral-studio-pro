# Fix: Wrong Caption Language — French Subtitles on English Content

## Context
Our render pipeline burns subtitles/captions into the final video output. In 12 of 50 audited clips, the captions appeared in French ('dans mon corps', 'des changements') while the hook/title overlay was in English ('I'M LITERALLY DEAD', 'NOBODY EXPECTED THIS'). This creates a confusing bilingual mismatch. The root cause is likely one of: (a) the speech-to-text (STT) module is not detecting the correct language, (b) the wrong subtitle track is being selected from the source, or (c) the source clip itself has embedded French subtitles that are being passed through without validation.

## What to Fix
Add language detection and validation to the caption pipeline so that captions always match the target audience language.

## Requirements
1. **Add explicit language detection on the audio track** before running STT. Use a lightweight language ID model (e.g., Whisper's built-in language detection, or `langdetect` on a preliminary transcript). Log the detected language.
2. **Add a `target_language` parameter** to the render pipeline configuration. Default to `'en'` (English). All caption generation must use this parameter to force the STT language.
3. **If detected audio language ≠ target_language**, flag the clip for review and either: (a) skip caption generation, (b) run translation, or (c) surface a warning to the user: "This clip appears to be in French. Captions may not match your target audience."
4. **Validate caption language post-generation**: After generating the SRT/VTT file, run a quick language detection on the concatenated caption text. If it doesn't match `target_language`, block the render and log an error.
5. **Check for burned-in source subtitles**: If the source clip already has hardcoded/burned-in subtitles in a different language, detect this (via OCR on a sample frame in the lower third) and warn the user. These cannot be removed but the user should be informed.
6. **Ensure hook/title overlay language matches caption language**: Add a validation step that compares the language of the hook text overlay with the caption language. If they differ, flag as an error.
7. **Force Whisper language parameter**: If using OpenAI Whisper for STT, pass `language='en'` explicitly rather than relying on auto-detection: `whisper.transcribe(audio, language='en')`.

## Files likely involved
- Caption/subtitle generation module (likely calling Whisper, Deepgram, or similar STT API)
- Render pipeline where SRT/VTT is loaded and burned into the video
- Any configuration for language settings
- Hook/title overlay generation code

## Validation
- Process a clip with French audio and English hook text — confirm the system either generates English captions, blocks the render, or warns the user
- Process a clip with English audio — confirm English captions are generated
- Confirm the language validation catches a manually-injected French SRT file on an English-targeted render