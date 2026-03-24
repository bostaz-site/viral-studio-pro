# Viral Studio Pro Render API

Express.js server running on a Hetzner VPS (Ubuntu 24.04) for video rendering using FFmpeg.

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
│  Hetzner VPS (This Server)              │
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

## Quick Start

### 1. Initial Setup

```bash
# Clone the repository
git clone <repo-url> /opt/viral-studio
cd /opt/viral-studio/vps

# Run setup script (as root or with sudo)
sudo bash setup.sh

# Or manual setup:
npm install
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```bash
nano .env
```

Required variables:
- `API_SECRET` — Strong random string (use `openssl rand -base64 32`)
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key from Supabase
- `TEMP_DIR` — Temporary directory for rendering (must be writable)
- `OUTPUT_DIR` — Output directory for rendered clips

### 3. Start the Server

```bash
# Development
npm run dev

# Production with PM2
npm run pm2-start

# Check status
pm2 status

# View logs
pm2 logs viral-studio-api
```

### 4. Verify Health

```bash
curl http://localhost:3100/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-24T10:30:00.000Z",
  "uptime": "123s",
  "components": {
    "ffmpeg": { "available": true },
    "ffprobe": { "available": true },
    "ytdlp": { "available": true },
    "supabase": { "connected": true }
  }
}
```

## API Endpoints

### POST /api/render

Main endpoint for rendering clips.

**Authentication:** `x-api-key` header required

**Request:**
```json
{
  "clipId": "550e8400-e29b-41d4-a716-446655440000",
  "settings": {
    "captions": {
      "enabled": true,
      "style": "hormozi",
      "fontSize": 72,
      "wordsPerLine": 6
    },
    "format": {
      "aspectRatio": "9:16",
      "cropAnchor": "center",
      "backgroundBlur": false,
      "crf": 23
    },
    "branding": {
      "watermark": true,
      "watermarkPosition": "bottom-right"
    }
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "clipId": "550e8400-e29b-41d4-a716-446655440000",
    "storagePath": "user-id/clip-id.mp4",
    "clipUrl": "https://supabase-url/storage/.../clip-id.mp4",
    "duration": 45.5,
    "thumbnailPath": "user-id/clip-id_thumb.png"
  },
  "message": "Clip rendered successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "FFmpeg render failed: ...",
  "message": "Render failed",
  "sessionId": "session-uuid"
}
```

### POST /api/render/caption

Generate ASS subtitle file for preview or download.

**Request:**
```json
{
  "wordTimestamps": [
    { "word": "Hello", "start": 0.5, "end": 1.2 },
    { "word": "world", "start": 1.3, "end": 2.0 }
  ],
  "style": "hormozi",
  "clipStartTime": 0,
  "wordsPerLine": 6
}
```

**Response:** ASS file (text/plain)

### POST /api/download

Download video from URL (YouTube, TikTok, Instagram, etc).

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "platform": "youtube"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filePath": "/tmp/viral-studio-render/session-id/video.mp4",
    "filename": "video.mp4",
    "metadata": {
      "title": "Video Title",
      "duration": 123,
      "uploader": "Channel Name",
      "view_count": 1000000,
      "platform": "youtube"
    },
    "sessionId": "session-uuid"
  }
}
```

### GET /api/health

Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-24T10:30:00.000Z",
  "uptime": "123s",
  "components": {
    "ffmpeg": { "available": true },
    "supabase": { "connected": true }
  }
}
```

## Caption Styles

Available styles for karaoke captions:

- `hormozi` — Large bold yellow text (default)
- `mrbeast` — White text with black shadow
- `neon` — Cyan/magenta neon effect
- `minimal` — Clean, minimal sans-serif
- `impact` — High contrast impact font

Example with custom colors:

```json
{
  "wordTimestamps": [...],
  "style": "hormozi",
  "customColors": {
    "primaryColor": "#FFFF00",
    "secondaryColor": "#FF0000",
    "fontSize": 80
  }
}
```

## Performance Tuning

### Memory Management

By default, Node.js is limited to 1GB. Adjust in `ecosystem.config.js`:

```js
node_args: '--max-old-space-size=2048', // 2GB
```

### FFmpeg Presets

Adjust rendering speed/quality via `crf` parameter:

- `crf: 18` — High quality (slower, larger file)
- `crf: 23` — Default (balanced)
- `crf: 28` — Lower quality (faster, smaller file)

### Concurrent Renders

Currently limited to 1 instance. To enable multiple concurrent renders:

```js
instances: 4, // Use 4 CPU cores
```

Note: Ensure you have sufficient disk space and memory.

## Troubleshooting

### FFmpeg not found

```bash
which ffmpeg
ffmpeg -version

# Install if missing:
apt-get update && apt-get install -y ffmpeg
```

### yt-dlp not found

```bash
which yt-dlp
yt-dlp --version

# Install if missing:
pip3 install --upgrade yt-dlp
```

### Supabase connection error

Check credentials in `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

### PM2 won't start

```bash
pm2 delete all
npm run pm2-start
pm2 logs viral-studio-api
```

### Disk space full

Check usage:
```bash
df -h
du -sh /opt/viral-studio/tmp

# Clean old temp files:
rm -rf /opt/viral-studio/tmp/*
```

## Logs

View application logs:

```bash
# Real-time logs
pm2 logs viral-studio-api

# Last 100 lines
pm2 logs viral-studio-api --lines 100

# From log file
tail -f /var/log/viral-studio/api.out.log
tail -f /var/log/viral-studio/api.error.log
```

## Deployment

### Using PM2

```bash
# Start
pm2 start ecosystem.config.js

# Restart (for code updates)
pm2 restart viral-studio-api

# Stop
pm2 stop viral-studio-api

# Delete from PM2 management
pm2 delete viral-studio-api

# View all apps
pm2 list
```

### Using Nginx as Reverse Proxy

Create `/etc/nginx/sites-available/viral-studio-api`:

```nginx
server {
    listen 80;
    server_name api.viral-studio-pro.com;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/viral-studio-api /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### SSL Certificate (Let's Encrypt)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot certonly --nginx -d api.viral-studio-pro.com
```

## Environment Variables Reference

```env
# Server
PORT=3100                                  # API port
NODE_ENV=production                        # Environment
API_SECRET=your-strong-secret-key          # API authentication

# Supabase
SUPABASE_URL=https://project.supabase.co  # Supabase URL
SUPABASE_SERVICE_ROLE_KEY=key              # Service role key

# File System
TEMP_DIR=/opt/viral-studio/tmp            # Temporary files
OUTPUT_DIR=/opt/viral-studio/output       # Rendered output
FFMPEG_PATH=ffmpeg                         # FFmpeg binary path
YTDLP_PATH=yt-dlp                         # yt-dlp binary path

# Limits
MAX_RENDER_TIME_SECONDS=300                # Max render duration
MAX_FILE_SIZE_BYTES=2147483648             # Max input file (2GB)

# Logging
LOG_LEVEL=info                             # Log level
```

## Security Considerations

1. **API Secret** — Use a strong random string
   ```bash
   openssl rand -base64 32
   ```

2. **Service Role Key** — Highly sensitive, never expose
   - Store in `.env` (never in git)
   - Use environment variables in production
   - Rotate periodically

3. **Firewall** — Restrict API access
   ```bash
   ufw allow from 203.0.113.0/24 to any port 3100
   ```

4. **HTTPS** — Always use SSL in production
   - Use Nginx reverse proxy
   - Use Let's Encrypt certificates

## Monitoring

### Uptime Monitoring

Use a service like Better Uptime or Pingdom to monitor `/api/health`:

```
GET http://your-api.com/api/health
Expected: 200 response with "healthy" status
```

### Disk Space

Set up alerts for disk usage:

```bash
# Check space
df -h /opt/viral-studio

# Alert when less than 10GB available
# Use cron job or monitoring service
```

### Memory Usage

PM2 auto-restarts if process exceeds `max_memory_restart`:

```
max_memory_restart: '500M' (in ecosystem.config.js)
```

## Support & Contributing

For issues or feature requests, contact the Viral Studio Pro team.

## License

Proprietary — Viral Studio Pro
