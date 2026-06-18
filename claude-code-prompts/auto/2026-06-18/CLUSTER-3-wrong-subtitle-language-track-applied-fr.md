# Fix: Caption language detection and validation

## Context
All rendered clips show French subtitles ('dans mon corps', 'des changements') despite English title overlays ('I'M LITERALLY DEAD', 'NOBODY EXPECTED THIS'). The caption pipeline is either hardcoded to French, using a wrong default, or the language detection (if any) is misidentifying the audio. This creates a jarring bilingual mismatch on every clip.

## Files to modify
- `src/render/captions/generator.ts` (or `subtitles.ts`, `stt.ts`) — the module that calls the ASR/speech-to-text service
- `src/render/captions/config.ts` — language parameter defaults
- `src/render/pipeline.ts` — where caption generation is invoked
- `src/render/captions/validator.ts` — create this if it doesn't exist

## Steps
1. **Find the language parameter**: Search for where the ASR service is called (Whisper, Deepgram, AssemblyAI, etc.). Look for `language`, `lang`, `locale` parameters. Check if it's hardcoded to `'fr'` or if no language is specified (causing auto-detect to pick French from ambiguous audio).
2. **Fix the default**: Set the default language to `'en'` explicitly. If the product supports multiple languages, make this a user-configurable field in clip settings.
3. **Add language detection**: Before ASR, run a short audio sample (first 10 seconds) through a language identification step. Whisper's `detect_language` or a lightweight language-ID model can do this. Use the detected language as the ASR language parameter.
4. **Add cross-validation**: After caption generation, compare the detected caption language against the title/hook overlay language. If they mismatch, log a warning and either: (a) re-run ASR with the title language, or (b) flag the clip for review.
5. **Add a language field to clip metadata**: Store `detected_language` and `caption_language` in the clip record so it can be audited.
6. **Test**: Create a test case with English audio and assert captions are generated in English. Create a test case where title is English but audio is French and assert a warning is raised.

## Definition of Done
- Captions are generated in the correct language matching the audio
- Language mismatch between title overlay and captions triggers a warning/fallback
- Default language is explicitly set (not relying on auto-detect alone)
- `detected_language` stored in clip metadata
- No French captions appear on English-titled clips

## Commit message
```
fix(captions): add language detection and validation — prevent French subtitles on English content
```