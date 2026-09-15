# Render Pipeline

VPS on Railway (`bostaz-site-production.up.railway.app`). Express + ESM, FFmpeg + Python/OpenCV.

## Tier ladder (default: HIGH_30)
| Tier | Resolution | CRF | FPS | Preset |
|------|-----------|-----|-----|--------|
| HIGH_30 (default) | 1080×1920 | 20 | 30 | fast |
| HIGH_60 (opt-in `quality='60fps'`) | 1080×1920 | 20 | 60 | fast |
| SAFE | 720×1280 | 23 | 30 | faster |
| LAST_RESORT | 720×1280 | 26 | 30 | ultrafast |

Auto-fallback on OOM. Max output 45 MB (Supabase limit). Re-encode if exceeded.

## Filter pipeline order
`scale/crop → eq (exposure) → unsharp → ASS subtitles → hook overlay → tag overlay → watermark → grain → color shift → format=yuv420p`

## Compositing modes
- **fullframe**: center crop 9:16, no padding. Best for facecam.
- **fit**: full image + deep cinematic blur padding (sigma=24, sat=0.5). Best for gameplay.
- **reaction**: facecam top 32% + content bottom 68% via vstack. Auto-detected by crop advisor.
- **split-screen**: content top 55% + gameplay bottom 45%. Gameplay from `gameplay/` Supabase bucket, looped, muted, desaturated.
- **duo**: two speakers stacked 50/50.

## Smart Zoom (default: dynamic)
- **dynamic**: punch zooms on audio peaks. 10-12% amplitude (strong) / 8% (medium). Smoothstep rise 0.25s → hold 1.3s → fall 0.55s. Max 6 punches, cooldown 6-8s (seeded by diversify).
- **follow**: real face tracking with 1.20x zoom. Dead zone 10%, max speed 3%/sample, inertia 0.94.
- **micro**: slow push 1.0 → 1.06 (fallback when no peaks).

## Audio chain (order matters)
1. Audio enhance (optional): highpass 80Hz + compressor + limiter
2. Audio shift: +0.5-1.5% asetrate/atempo (diversified, anti-fingerprint)
3. Bass boost (optional)
4. SFX mix (if soundDesign != 'off'): mood-mapped WAV effects on audio peaks, amixed
5. **Loudnorm (LAST)**: EBU R128 I=-14 TP=-2.0 LRA=11

## SFX Layer (`vps/lib/sfx.js`)
Mood → family mapping: rage→bass hit/glitch, funny→boom/pop, hype→whoosh. Max 1/4s, -12dB (subtle) or -6dB (punchy). Selection + timing jitter seeded by diversify.

## Watermark (free plan)
`vps/assets/watermark.png` (white wolf + text, 400×120). `scale=iw*0.18`, alpha 0.55, position `W-w-40:H-h-360`. End-card OFF by default.

## Render Contract (`vps/lib/render-contract.js`)
Tracks requested vs applied features. Critical (degrade render): `captions`, `hook_text`. Cosmetic: `audio_shift`, `smart_zoom`, `sfx`, `split_screen`, `watermark`, `variants`.

**Transform score** (0-3): +1 hook_text + +1 captions + +1 smart_zoom. Min 2 for autofarm.

## Diversification (`vps/lib/diversify.js`)
Deterministic seed from jobId (SHA-256 → xorshift32). Varies: audio shift, caption marginV/size/accent color, hook position/size/timing, zoom amplitude/phase, grain (1-3), border crop (40-60px), hue/saturation/brightness, CRF variant.

## Burned Caption Detection (`vps/lib/caption-detector.js`)
Runs AFTER Whisper (not parallel). Whisper 0 words → burned=false. Haiku vision checks 3 frames with explicit negatives (chat, HUD, alerts). Cross-validates visible text against Whisper words (≥2/3 frames, ≥50% overlap). Twitch/Kick threshold: 0.98 (was 0.7). When detected: captions STAY ENABLED (coverage mode).

## Retention Risk (`vps/lib/retention-risk.js`)
Score 0-100. Signals: static cam +35, duo +15, low motion +25, sparse peaks +20, low density +15, long static +5. Floor: fit/static → ≥55 (split-screen recommended).

## CTA Follow (`vps/lib/cta-overlay.js`)
Last ~1.2s, ~80% height, caption-like. Variants seeded. Truncates overlapping caption lines (0.2s buffer). Default ON.

## Key files
- `vps/routes/render.js` — main route, orchestrates pipeline
- `vps/lib/ffmpeg-render.js` — filter building, tier ladder, renderClip()
- `vps/lib/render-contract.js` — feature tracking
- `vps/lib/diversify.js` — per-render variation
- `vps/lib/crop-advisor.js` — face detection → layout recommendation
- `vps/lib/audio-peaks.js` — peak detection with intensity
- `vps/lib/subtitle-generator.js` — ASS karaoke captions
- `vps/lib/hook-generator.js` — Claude Haiku hook text
- `vps/lib/sfx.js` — sound effects
- `vps/lib/retention-risk.js` — split-screen recommendation
- `vps/test-build-args.mjs` — smoke test (catches TDZ)
