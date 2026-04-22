# Enhance & Render

## Description

The enhance page lets users configure viral enhancement settings for a clip (captions, split-screen, hook, streamer tag, format, smart zoom, audio enhance, auto-cut). Settings are sent to the Next.js API which creates a render job and dispatches it to the VPS (Railway) running FFmpeg. The VPS renders the video, uploads it to Supabase Storage, and updates the render job status.

## SQL Tables

### `render_jobs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| clip_id | TEXT | ID of the source clip |
| source | TEXT | 'trending' or 'clips' |
| user_id | UUID | FK -> profiles.id |
| status | TEXT | 'pending' / 'rendering' / 'done' / 'error' |
| storage_path | TEXT | Path in Supabase Storage (set by VPS on completion) |
| clip_url | TEXT | Signed download URL |
| error_message | TEXT | Error details if failed |
| debug_log | TEXT | FFmpeg debug output |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `clips`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| video_id | UUID | FK -> videos.id |
| user_id | UUID | FK -> profiles.id |
| title | TEXT | |
| start_time | FLOAT | |
| end_time | FLOAT | |
| duration_seconds | FLOAT | |
| storage_path | TEXT | |
| caption_template | TEXT | Default 'default' |
| aspect_ratio | TEXT | Default '9:16' |
| status | TEXT | 'pending' / 'rendering' / 'done' / 'error' |

### `transcriptions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| video_id | UUID | FK -> videos.id |
| full_text | TEXT | Full transcript |
| language | TEXT | |
| segments | JSONB | Sentence-level segments |
| word_timestamps | JSONB | Word-level timestamps [{word, start, end}] |
| created_at | TIMESTAMPTZ | |

## API Routes

### `POST /api/render`

Protected via `withAuth`. Rate limited: 5 renders/minute.

**Request body** (validated with zod):
```json
{
  "clip_id": "uuid",
  "source": "trending" | "clips",
  "settings": {
    "captions": { "enabled": true, "style": "hormozi", "fontSize": 78, "wordsPerLine": 4, "animation": "highlight", "emphasisEffect": "scale", "emphasisColor": "red" },
    "splitScreen": { "enabled": false, "layout": "top-bottom", "brollCategory": "minecraft", "ratio": 50 },
    "hook": { "enabled": false, "text": "...", "style": "choc", "reorderEnabled": false, "overlayPng": "base64..." },
    "tag": { "style": "none", "authorName": "...", "overlayPng": "base64..." },
    "format": { "aspectRatio": "9:16", "videoZoom": "fill" },
    "smartZoom": { "enabled": false, "mode": "micro" },
    "audioEnhance": { "enabled": false },
    "autoCut": { "enabled": false, "silenceThreshold": 0.5 }
  }
}
```

**Flow**:
1. Validates input with zod schema
2. Resolves the clip source (trending_clips, clips, or videos table)
3. Enforces plan limits (clip duration + monthly quota via `increment_video_usage` RPC)
4. Resolves Twitch URLs to signed CDN MP4s via GQL API
5. Creates a `render_jobs` row with status 'pending'
6. Fire-and-forget POST to VPS `/api/render` (15s abort timeout -- POST body delivery, not render completion)
7. Returns job ID immediately to the client

**Response**: `{ data: { clip_id, jobId, rendered: false, source, vpsReady: true }, message: "Render started" }`

## VPS (Railway)

### `vps/server.js`

Express.js server with:
- CORS for viralanimal.com + localhost:3000
- API key authentication (timing-safe comparison)
- Routes: `/api/health`, `/api/render`, `/api/download`
- 10MB body limit (for base64 overlay PNGs)

### `vps/lib/ffmpeg-render.js`

Main render engine. Handles:
- Video downloading (from Supabase signed URLs or Twitch CDN)
- Aspect ratio reframing (9:16, 16:9, 1:1)
- Split-screen compositing (top-bottom layout with gameplay B-roll)
- Hook overlay (browser-captured PNG composited with FFmpeg)
- Streamer tag overlay (browser-captured PNG)
- Smart zoom (micro/dynamic/follow modes)
- Audio enhancement (loudnorm filter)
- Auto-cut (silence removal)
- ASS subtitle burn-in

### `vps/lib/subtitle-generator.js`

Generates ASS subtitle files with:
- Multiple caption styles: hormozi, hormozi-purple, mrbeast, neon, minimal, impact, aliabdaal, imangadzhi, bold, default
- Animation modes: highlight (karaoke fill), word-pop, pop, bounce, shake, typewriter, glow
- Emphasis detection for important words (ALL CAPS, exclamation, hype words)
- Custom emphasis colors: red, yellow, cyan, green, orange, pink, purple, white
- Position-aware rendering (adjusts for split-screen)
- Static captions fallback for clips without word timestamps

## UI Components

### Enhance Page (`app/(dashboard)/dashboard/enhance/[clipId]/page.tsx`)

Large client component with settings panels for:
- Caption style picker with live preview
- Split-screen toggle + B-roll category
- Hook configuration (text + style + reorder segments)
- Streamer tag overlay
- Format panel (aspect ratio + zoom mode)
- Smart zoom toggle
- Audio enhance toggle
- Auto-cut toggle

Uses `useTrendingStore` for clip data and makes POST to `/api/render`.

### Enhance Landing (`app/(dashboard)/dashboard/enhance/page.tsx`)

Simple landing page shown when no clip is selected. Links to upload or browse.

## User Flow

1. User browses clips or uploads one
2. Clicks on a clip -> navigates to `/dashboard/enhance/[clipId]`
3. Configures settings (captions, split-screen, hook, etc.)
4. Clicks "Make Viral" button
5. POST `/api/render` creates render job, dispatches to VPS
6. UI polls render job status
7. VPS renders with FFmpeg, uploads to Supabase Storage
8. Status updates to 'done', UI shows download button

## AI Mood Detection System

### Overview

The "Make It Viral" button detects the clip's mood via Claude Haiku and applies a mood-optimized preset instead of a fixed one. Users can also manually select a mood to override.

### Files

- `lib/ai/mood-detector.ts` — Claude Haiku API call, prompt, parsing
- `lib/ai/mood-presets.ts` — 6 mood presets mapping to EnhanceSettings
- `app/api/enhance/ai-optimize/route.ts` — Protected API route

### 6 Moods

| Mood | Emoji | Caption Style | Emphasis | Zoom | Hook Style | Reorder | Auto-cut |
|------|-------|--------------|----------|------|------------|---------|----------|
| Rage | fire | MrBeast | Scale/Red | Fill | Shock | Yes | Yes (0.5s) |
| Funny | laughing | Hormozi Purple | Bounce/Yellow | Fill | Curiosity | Yes | No |
| Drama | masks | Bold | Glow/Orange | Immersive | Suspense | Yes | No |
| Wholesome | sparkles | Minimal | None/White | Contain | Curiosity | No | No |
| Hype | trophy | Neon | Scale/Cyan | Fill | Shock | Yes | Yes (0.5s) |
| Story | speaking | Ali Abdaal | None/White | Contain | Suspense | No | Yes (0.7s) |

### Flow

1. User clicks "Make It Viral"
2. POST `/api/enhance/ai-optimize` with transcript/title/streamer/niche
3. Claude Haiku analyzes and returns mood + confidence + explanation
4. Mood preset is applied to all EnhanceSettings fields
5. Hook is generated with the mood's hookStyle
6. Auto-render starts

### Fallback

If Claude API fails for any reason, the system silently falls back to the "Hype" preset (most polyvalent).

### Manual Override

6 mood buttons are displayed below "Make It Viral". Clicking one applies that mood's preset without triggering auto-render. The AI-detected mood shows an "AI" badge.

### API: `POST /api/enhance/ai-optimize`

**Request**: `{ transcript, title?, streamer?, niche? }`

**Response**: `{ mood, confidence, explanation, secondary_mood, preset }`

### Detection Prompt

Claude Haiku receives the transcript and must classify into one of: rage, funny, drama, wholesome, hype, story. Returns JSON with mood, confidence (0-100), explanation, and optional secondary_mood.

## Technical Notes

- Render is fire-and-forget: the Next.js API aborts after 15s but the VPS continues
- VPS writes status updates directly to `render_jobs` via Supabase admin client
- Hook and tag overlays are captured as PNG in the browser (html2canvas) and sent as base64
- Twitch clip URLs are resolved via GQL API to get signed CloudFront MP4 URLs
- Plan enforcement happens before render: duration check + monthly quota via RPC
- Caption generation supports both word-timestamp mode (Whisper) and static mode (title text)
