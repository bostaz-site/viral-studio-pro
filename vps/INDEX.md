# Viral Studio Pro Render API — Complete File Index

Complete Express.js render API for Viral Studio Pro running on Hetzner VPS with FFmpeg, yt-dlp, and Supabase integration.

## Project Structure

```
vps/
├── server.js                    # Main Express server (entry point)
├── package.json                 # NPM dependencies & scripts
├── ecosystem.config.js          # PM2 configuration
├── setup.sh                     # Automated setup script
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
│
├── lib/                         # Core libraries
│   ├── ffmpeg-render.js         # FFmpeg video rendering engine
│   ├── subtitle-generator.js    # ASS subtitle file generator
│   ├── supabase-client.js       # Supabase database & storage client
│   └── yt-dlp-wrapper.js        # yt-dlp video downloader wrapper
│
├── routes/                      # API route handlers
│   ├── render.js                # POST /api/render endpoint
│   ├── download.js              # POST /api/download & metadata endpoints
│   └── health.js                # GET /api/health health check
│
└── docs/
    ├── README.md                # Main documentation
    ├── DEPLOYMENT.md            # Deployment checklist
    └── QUICK_REFERENCE.md       # Common commands reference
```

## Files Overview

### Core Application

#### server.js
- Main Express.js application
- CORS & middleware setup
- API key authentication
- Route registration
- Error handling
- Server startup & logging

**Key Features:**
- Express server on port 3100
- CORS configured for Netlify frontend
- API key auth via `x-api-key` header
- Request/response logging
- 404 & error handlers

#### package.json
- NPM dependencies
- Scripts for development & production
- Project metadata

**Dependencies:**
- express ^4.21.0
- cors ^2.8.5
- dotenv ^16.4.5
- uuid ^10.0.0
- @supabase/supabase-js ^2.43.4

**Scripts:**
```bash
npm start          # Production
npm run dev        # Development (watch mode)
npm run pm2-start  # Start with PM2
```

#### ecosystem.config.js
- PM2 application configuration
- Process management settings
- Memory limits (500MB)
- Log file paths
- Auto-restart on crash
- Startup on boot configuration

### Libraries

#### lib/ffmpeg-render.js
FFmpeg video processing engine with support for:
- Video cutting (startTime/endTime)
- Aspect ratio reframing (9:16, 1:1, 16:9)
- Caption overlays (ASS subtitle format)
- Watermarking (text or logo)
- Smart cropping (center/top/bottom)
- Thumbnail extraction
- Quality settings (CRF)
- System availability checks

**Main Functions:**
```js
renderClip(inputPath, outputPath, options)    // Core render
extractThumbnail(inputPath, outputPath, atSecond)
getVideoMetadata(inputPath)
checkFfmpegAvailability()
```

#### lib/subtitle-generator.js
ASS subtitle file generator with karaoke support:
- Karaoke word-by-word highlighting (\kf tags)
- Multiple caption styles:
  - hormozi (default)
  - mrbeast
  - neon
  - minimal
  - impact
- Custom colors
- Variable font sizes
- Position options

**Main Functions:**
```js
generateASS(wordTimestamps, options)          // Generate ASS content
getAvailableStyles()
getStyleConfig(styleName)
applyCustomColors(styleName, colors)
validateWordTimestamps(words)
```

#### lib/supabase-client.js
Supabase database & storage client:
- Download/upload files to Storage
- Fetch clip, video, transcription data
- Update clip status & results
- User profile queries
- Viral score creation
- Health checks

**Main Functions:**
```js
downloadFromStorage(bucketName, filePath, localPath)
uploadToStorage(bucketName, filePath, storagePath)
getClip(clipId)
getVideo(videoId)
getTranscription(videoId)
updateClipStatus(clipId, status)
updateClipAfterRender(clipId, duration, storagePath, thumbPath)
checkSupabaseHealth()
```

#### lib/yt-dlp-wrapper.js
Video downloader supporting YouTube, TikTok, Instagram, etc:
- Download videos from URLs
- Extract metadata without downloading
- Support for major platforms
- Progress tracking
- Error handling
- System availability checks

**Main Functions:**
```js
downloadVideo(videoUrl, outputPath, options)
getVideoMetadata(videoUrl)
checkYtdlpAvailability()
getSupportedPlatforms()
```

### Route Handlers

#### routes/render.js
Main rendering endpoint: `POST /api/render`

**Request:**
```json
{
  "clipId": "uuid",
  "settings": {
    "captions": {"enabled": true, "style": "hormozi", "wordsPerLine": 6},
    "format": {"aspectRatio": "9:16", "cropAnchor": "center"},
    "branding": {"watermark": true, "watermarkPosition": "bottom-right"}
  }
}
```

**Process:**
1. Validates FFmpeg & Supabase availability
2. Fetches clip metadata from database
3. Downloads source video
4. Generates ASS captions (if enabled)
5. Runs FFmpeg render
6. Extracts thumbnail
7. Uploads rendered clip & thumbnail
8. Updates database with results

**Additional Routes:**
- `POST /api/render/caption` — Generate ASS file only

#### routes/download.js
Video download endpoints:

**POST /api/download** — Download video from URL
```json
{"url": "https://youtube.com/watch?v=...", "platform": "youtube"}
```

**POST /api/download/metadata** — Get metadata only
```json
{"url": "https://youtube.com/watch?v=..."}
```

**DELETE /api/download/:sessionId** — Cleanup downloaded files

#### routes/health.js
Health check endpoint: `GET /api/health` (no auth required)

**Response includes:**
- Server status (healthy/degraded/error)
- Uptime
- Component availability (FFmpeg, yt-dlp, Supabase)
- Environment info

### Configuration & Setup

#### .env.example
Environment variable template:
```env
PORT=3100
NODE_ENV=production
API_SECRET=your-secret
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TEMP_DIR=/opt/viral-studio/tmp
OUTPUT_DIR=/opt/viral-studio/output
```

#### setup.sh
Automated deployment script that:
- Checks system prerequisites
- Installs FFmpeg, yt-dlp, Node.js, PM2
- Creates app user & directories
- Installs NPM dependencies
- Configures PM2 auto-start
- (Optional) Configures UFW firewall
- (Optional) Installs Nginx

**Usage:**
```bash
sudo bash setup.sh
```

#### .gitignore
Excludes:
- .env files
- node_modules/
- Logs & PM2 files
- Temporary video files
- OS & IDE files

### Documentation

#### README.md
Complete user guide covering:
- Architecture overview
- Quick start guide
- API endpoint documentation
- Request/response examples
- Caption styles
- Performance tuning
- Troubleshooting
- Deployment with Nginx
- SSL/HTTPS setup
- Monitoring
- Environment variables
- Security considerations

#### DEPLOYMENT.md
Step-by-step deployment checklist:
- Pre-deployment preparation
- System setup & dependencies
- Installation & configuration
- Environment setup
- Verification & testing
- Nginx reverse proxy setup
- SSL certificate (Let's Encrypt)
- Supabase integration
- Monitoring & alerts
- Log rotation & backups
- Load testing
- Post-deployment tasks
- Maintenance schedule
- Rollback procedures
- Troubleshooting guide

#### QUICK_REFERENCE.md
Quick reference guide with:
- Common PM2 commands
- API testing examples
- File management commands
- System information queries
- Troubleshooting procedures
- Performance tuning tips
- Database operations
- Deployment operations
- Security operations
- Emergency procedures

#### INDEX.md
This file — complete overview of the project structure and file purposes.

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/` | No | Info & endpoint listing |
| GET | `/api/health` | No | Health check |
| POST | `/api/render` | Yes | Render clip with FFmpeg |
| POST | `/api/render/caption` | Yes | Generate ASS subtitle file |
| POST | `/api/download` | Yes | Download video from URL |
| POST | `/api/download/metadata` | Yes | Get video metadata |
| DELETE | `/api/download/:sessionId` | Yes | Cleanup session |

## Technology Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js 4.21
- **Database:** Supabase PostgreSQL + Storage
- **Video Processing:** FFmpeg
- **Video Downloading:** yt-dlp
- **Process Manager:** PM2
- **Reverse Proxy:** Nginx (recommended)
- **Hosting:** Hetzner VPS (Ubuntu 24.04)

## Key Dependencies

- `express` — Web framework
- `cors` — CORS middleware
- `@supabase/supabase-js` — Supabase client
- `uuid` — UUID generation
- `dotenv` — Environment variables

## Deployment Options

### Local Development
```bash
npm run dev
```

### Production with PM2
```bash
npm run pm2-start
pm2 logs viral-studio-api
```

### Production with Nginx Reverse Proxy
- Configure Nginx to proxy to localhost:3100
- Setup SSL/HTTPS with Let's Encrypt
- See DEPLOYMENT.md for complete guide

## Security Features

- API key authentication (`x-api-key` header)
- CORS configuration for trusted origins
- Request validation (clipId, URL format)
- SQL injection prevention (Supabase ORM)
- File path traversal prevention
- Environment variable protection (.env)
- FFmpeg timeout limits
- Memory limits via PM2

## Performance Characteristics

- **Max render time:** 5 minutes (configurable)
- **Max input file size:** 2GB (configurable)
- **Memory limit:** 500MB (auto-restart)
- **Concurrent renders:** 1 (configurable)
- **Response time:** 10-60s for typical 30-90s clips
- **Storage:** Supabase (unlimited with proper plan)

## Getting Started

1. **Clone & Setup:**
   ```bash
   git clone <repo> /opt/viral-studio
   cd /opt/viral-studio/vps
   sudo bash setup.sh
   ```

2. **Configure:**
   ```bash
   sudo nano /opt/viral-studio/.env
   # Set API_SECRET, SUPABASE_* keys
   ```

3. **Verify:**
   ```bash
   curl http://localhost:3100/api/health
   ```

4. **Deploy:**
   Follow DEPLOYMENT.md for Nginx & SSL setup

## Monitoring

- Health check: `GET /api/health`
- Logs: `pm2 logs viral-studio-api`
- Status: `pm2 status`
- Monitoring: Setup external monitoring to `/api/health` endpoint

## Support & Updates

- Logs: `/var/log/viral-studio/`
- Configuration: `/opt/viral-studio/.env`
- Process management: `pm2` commands
- Troubleshooting: See QUICK_REFERENCE.md & README.md

---

**Version:** 1.0.0
**Last Updated:** 2026-03-24
**Status:** Production Ready
