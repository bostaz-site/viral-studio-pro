# Viral Studio Pro Render API

Express.js server deployed on **Railway** for video rendering using FFmpeg.

## Architecture

```
┌─────────────────────────────────────────┐
│   Netlify Frontend (Next.js)            │
└────────────────┬────────────────────────┘
                 │
          POST /api/render
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Railway (This Server)                  │
│  ├─ FFmpeg (video rendering)            │
│  ├─ yt-dlp (video downloading)          │
│  ├─ Node.js 20                          │
│  └─ Express API                         │
└────────────────┬────────────────────────┘
                 │
          Supabase Storage
          (upload/download)
                 │
                 ▼
┌─────────────────────────────────────────┐
│   Supabase PostgreSQL Database          │
│   (clip status, metadata, etc)          │
└─────────────────────────────────────────┘
```

## Deployment

Deployed on Railway via Docker. The `Dockerfile` and `railway.toml` handle all configuration.

**URL:** `https://bostaz-site-production.up.railway.app`

## Local Development

```bash
cd vps
npm install
cp .env.example .env
# Fill in .env with your Supabase keys and API secret
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/` | No | Service info |
| GET | `/api/health` | No | Health check (FFmpeg, yt-dlp, Supabase) |
| POST | `/api/render` | Yes | Render clip with FFmpeg |

### Authentication

All protected endpoints require the `x-api-key` header matching the `API_SECRET` env var.

### POST /api/render

Renders a clip with captions, split-screen, and format options.

```json
{
  "clipId": "uuid",
  "settings": {
    "captions": { "enabled": true, "style": "hormozi" },
    "splitScreen": { "enabled": true, "brollCategory": "minecraft" },
    "format": { "aspectRatio": "9:16" }
  }
}
```

## Environment Variables

```env
PORT=3100
NODE_ENV=production
API_SECRET=your-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
TEMP_DIR=/tmp/viral-studio-render
OUTPUT_DIR=/tmp/viral-studio-output
```

## Project Structure

```
vps/
├── server.js              # Main Express server
├── Dockerfile             # Docker config for Railway
├── railway.toml           # Railway deployment config
├── package.json           # Dependencies
├── .env.example           # Environment template
├── lib/
│   ├── ffmpeg-render.js   # FFmpeg rendering engine
│   ├── subtitle-generator.js  # ASS subtitle generator (karaoke)
│   └── supabase-client.js # Supabase DB & Storage client
└── routes/
    ├── render.js          # POST /api/render
    └── health.js          # GET /api/health
```

## Caption Styles

Available karaoke subtitle styles: `hormozi` (default), `mrbeast`, `neon`, `minimal`, `impact`.
