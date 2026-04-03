#!/bin/bash
# ============================================
# Viral Studio Pro — VPS One-Shot Deploy
# Run this on your Hetzner VPS as root
# ============================================
set -e

echo "🚀 Starting Viral Studio Pro VPS Setup..."

# Wait for cloud-init to finish (if still running)
echo "⏳ Waiting for cloud-init to finish..."
cloud-init status --wait 2>/dev/null || true

# Install system dependencies
echo "📦 Installing system packages..."
apt-get update -qq
apt-get install -y -qq ffmpeg python3-pip git curl unzip nodejs npm 2>/dev/null || {
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

# Install global tools
echo "🔧 Installing PM2 and yt-dlp..."
npm install -g pm2 2>/dev/null || true
pip3 install yt-dlp --break-system-packages 2>/dev/null || pip3 install yt-dlp || true

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/viral-studio/tmp
mkdir -p /opt/viral-studio/output
mkdir -p /opt/viral-studio/lib
mkdir -p /opt/viral-studio/routes

# Verify installations
echo "✅ Checking installations..."
echo "  FFmpeg: $(ffmpeg -version 2>&1 | head -1)"
echo "  Node:   $(node -v)"
echo "  NPM:    $(npm -v)"
echo "  PM2:    $(pm2 -v 2>/dev/null || echo 'not found')"
echo "  yt-dlp: $(yt-dlp --version 2>/dev/null || echo 'not found')"

# Create package.json
cat > /opt/viral-studio/package.json << 'PKGJSON'
{
  "name": "viral-studio-render-api",
  "version": "1.0.0",
  "description": "FFmpeg render API for Viral Studio Pro",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop viral-studio-api",
    "pm2:logs": "pm2 logs viral-studio-api"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.100.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  }
}
PKGJSON

# Create .env with real values
cat > /opt/viral-studio/.env << 'ENVFILE'
PORT=3100
NODE_ENV=production
API_SECRET=vsp-render-secret-2026
SUPABASE_URL=https://swlbdlgwqeinwxuviwgn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bGJkbGd3cWVpbnd4dXZpd2duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5MjI5MywiZXhwIjoyMDg5ODY4MjkzfQ.ky5U-fx3UQ8IDhP_ZYu0AZ-GG-9RaNJS3ZsFlpacOjA
TEMP_DIR=/opt/viral-studio/tmp
OUTPUT_DIR=/opt/viral-studio/output
FFMPEG_PATH=ffmpeg
YTDLP_PATH=yt-dlp
MAX_RENDER_TIME_SECONDS=300
MAX_FILE_SIZE_BYTES=2147483648
LOG_LEVEL=info
ENVFILE

# Create ecosystem.config.js (PM2)
cat > /opt/viral-studio/ecosystem.config.js << 'PM2CFG'
module.exports = {
  apps: [{
    name: 'viral-studio-api',
    script: 'server.js',
    cwd: '/opt/viral-studio',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '500M',
    instances: 1,
    autorestart: true,
    watch: false,
    error_file: '/opt/viral-studio/logs/error.log',
    out_file: '/opt/viral-studio/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
PM2CFG

mkdir -p /opt/viral-studio/logs

# Create server.js
cat > /opt/viral-studio/server.js << 'SERVERJS'
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3100;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth middleware
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/render', authMiddleware, require('./routes/render'));
app.use('/api/download', authMiddleware, require('./routes/download'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Viral Studio Render API running on port ${PORT}`);
});
SERVERJS

# Create health route
cat > /opt/viral-studio/routes/health.js << 'HEALTHJS'
const router = require('express').Router();
const { execSync } = require('child_process');

router.get('/', (req, res) => {
  let ffmpegOk = false;
  let ytdlpOk = false;
  try { execSync('ffmpeg -version', { timeout: 5000 }); ffmpegOk = true; } catch {}
  try { execSync('yt-dlp --version', { timeout: 5000 }); ytdlpOk = true; } catch {}

  res.json({
    status: 'ok',
    ffmpeg: ffmpegOk,
    ytdlp: ytdlpOk,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
HEALTHJS

# Create render route
cat > /opt/viral-studio/routes/render.js << 'RENDERJS'
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { renderClip } = require('../lib/ffmpeg-render');
const { generateASS } = require('../lib/subtitle-generator');
const { downloadFromSupabase, uploadToSupabase, updateClipStatus } = require('../lib/supabase-client');

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const jobId = uuidv4();
  const tmpDir = process.env.TEMP_DIR || '/opt/viral-studio/tmp';

  console.log(`[${jobId}] 🎬 New render job started`);

  try {
    const { videoStoragePath, clipStartTime, clipEndTime, clipId, settings, wordTimestamps } = req.body;

    if (!videoStoragePath || clipStartTime === undefined || clipEndTime === undefined) {
      return res.status(400).json({ error: 'Missing required fields: videoStoragePath, clipStartTime, clipEndTime' });
    }

    // 1. Download source video from Supabase
    console.log(`[${jobId}] Downloading source video...`);
    const inputPath = path.join(tmpDir, `${jobId}-input.mp4`);
    await downloadFromSupabase(videoStoragePath, inputPath);
    console.log(`[${jobId}] Downloaded: ${inputPath}`);

    // 2. Generate subtitle file if captions enabled
    let assPath = null;
    if (settings?.captions?.enabled && wordTimestamps?.length > 0) {
      console.log(`[${jobId}] Generating subtitles...`);
      const assContent = generateASS(wordTimestamps, settings.captions, clipStartTime);
      assPath = path.join(tmpDir, `${jobId}-subs.ass`);
      fs.writeFileSync(assPath, assContent);
    }

    // 3. Render with FFmpeg
    const outputPath = path.join(tmpDir, `${jobId}-output.mp4`);
    console.log(`[${jobId}] Rendering clip...`);
    await renderClip(inputPath, outputPath, {
      startTime: clipStartTime,
      endTime: clipEndTime,
      assPath,
      aspectRatio: settings?.format?.aspectRatio || '9:16',
      smartZoom: settings?.format?.smartZoom || false,
      backgroundBlur: settings?.format?.backgroundBlur || false,
      watermark: settings?.branding?.watermark || false,
      watermarkText: 'Viral Studio Pro',
      creditText: settings?.branding?.creditText || null,
      splitScreen: settings?.splitScreen || { enabled: false },
    });

    // 4. Upload rendered clip to Supabase
    const storagePath = `clips/${clipId || jobId}.mp4`;
    console.log(`[${jobId}] Uploading to Supabase...`);
    const publicUrl = await uploadToSupabase(outputPath, storagePath);

    // 5. Update clip status in DB
    if (clipId) {
      await updateClipStatus(clipId, 'done', storagePath);
    }

    // 6. Cleanup temp files
    [inputPath, outputPath, assPath].forEach(f => {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${jobId}] ✅ Render complete in ${duration}s`);

    res.json({
      success: true,
      jobId,
      clipUrl: publicUrl,
      storagePath,
      renderTime: `${duration}s`
    });

  } catch (err) {
    console.error(`[${jobId}] ❌ Render failed:`, err.message);
    // Cleanup on error
    const tmpFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith(jobId));
    tmpFiles.forEach(f => fs.unlinkSync(path.join(tmpDir, f)));

    res.status(500).json({ error: err.message, jobId });
  }
});

module.exports = router;
RENDERJS

# Create download route
cat > /opt/viral-studio/routes/download.js << 'DLJS'
const router = require('express').Router();
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const jobId = uuidv4();
  const tmpDir = process.env.TEMP_DIR || '/opt/viral-studio/tmp';
  const outputPath = path.join(tmpDir, `${jobId}.mp4`);

  try {
    // Get metadata first
    const metadata = await new Promise((resolve, reject) => {
      execFile('yt-dlp', ['--dump-json', '--no-download', url], { timeout: 30000 }, (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Failed to parse metadata')); }
      });
    });

    // Download video
    await new Promise((resolve, reject) => {
      execFile('yt-dlp', [
        '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '--merge-output-format', 'mp4',
        '-o', outputPath,
        url
      ], { timeout: 120000 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.json({
      success: true,
      jobId,
      filePath: outputPath,
      metadata: {
        author: metadata.uploader || metadata.channel || 'Unknown',
        title: metadata.title || 'Untitled',
        duration: metadata.duration || 0,
        platform: metadata.extractor || 'unknown'
      }
    });
  } catch (err) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
DLJS

# Create FFmpeg render lib
cat > /opt/viral-studio/lib/ffmpeg-render.js << 'FFMPEGJS'
const { execFile } = require('child_process');
const fs = require('fs');

const ASPECT_RATIOS = {
  '9:16': { w: 1080, h: 1920 },
  '1:1':  { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

function renderClip(inputPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      startTime = 0, endTime, assPath,
      aspectRatio = '9:16', backgroundBlur = false,
      watermark = false, watermarkText = 'Viral Studio Pro',
      creditText = null
    } = options;

    const target = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['9:16'];
    const duration = endTime - startTime;

    const filters = [];

    // Trim
    // Scale and crop to target aspect ratio
    if (aspectRatio === '9:16') {
      if (backgroundBlur) {
        // Blurred background + centered video
        filters.push(`split[bg][fg]`);
        filters.push(`[bg]scale=${target.w}:${target.h}:force_original_aspect_ratio=increase,crop=${target.w}:${target.h},boxblur=20:5[blurred]`);
        filters.push(`[fg]scale=${target.w}:${target.h}:force_original_aspect_ratio=decrease[scaled]`);
        filters.push(`[blurred][scaled]overlay=(W-w)/2:(H-h)/2[composed]`);
      } else {
        filters.push(`scale=${target.w}:${target.h}:force_original_aspect_ratio=decrease,pad=${target.w}:${target.h}:(ow-iw)/2:(oh-ih)/2:black[composed]`);
      }
    } else {
      filters.push(`scale=${target.w}:${target.h}:force_original_aspect_ratio=decrease,pad=${target.w}:${target.h}:(ow-iw)/2:(oh-ih)/2:black[composed]`);
    }

    // Subtitles
    if (assPath && fs.existsSync(assPath)) {
      const escapedPath = assPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
      filters.push(`[composed]ass='${escapedPath}'[subtitled]`);
    } else {
      filters.push(`[composed]null[subtitled]`);
    }

    // Watermark
    if (watermark && watermarkText) {
      filters.push(`[subtitled]drawtext=text='${watermarkText}':fontsize=24:fontcolor=white@0.5:x=w-tw-20:y=h-th-20[final]`);
    } else if (creditText) {
      filters.push(`[subtitled]drawtext=text='${creditText}':fontsize=20:fontcolor=white@0.7:x=20:y=h-th-20[final]`);
    } else {
      filters.push(`[subtitled]null[final]`);
    }

    const filterChain = filters.join(';');

    const args = [
      '-y',
      '-ss', String(startTime),
      '-t', String(duration),
      '-i', inputPath,
      '-filter_complex', filterChain,
      '-map', '[final]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-shortest',
      outputPath
    ];

    console.log(`  FFmpeg: rendering ${duration.toFixed(1)}s clip at ${aspectRatio}`);

    const timeout = (process.env.MAX_RENDER_TIME_SECONDS || 300) * 1000;
    execFile('ffmpeg', args, { timeout }, (err, stdout, stderr) => {
      if (err) {
        console.error('  FFmpeg stderr:', stderr?.slice(-500));
        return reject(new Error(`FFmpeg failed: ${err.message}`));
      }
      if (!fs.existsSync(outputPath)) {
        return reject(new Error('FFmpeg produced no output file'));
      }
      const size = fs.statSync(outputPath).size;
      console.log(`  FFmpeg: output ${(size / 1024 / 1024).toFixed(1)} MB`);
      resolve(outputPath);
    });
  });
}

module.exports = { renderClip };
FFMPEGJS

# Create subtitle generator
cat > /opt/viral-studio/lib/subtitle-generator.js << 'SUBJS'
const STYLES = {
  hormozi: { fontname: 'Arial', fontsize: 72, bold: true, primaryColor: '&H0000FFFF', outlineColor: '&H00000000', outline: 4, shadow: 2 },
  mrbeast: { fontname: 'Impact', fontsize: 68, bold: true, primaryColor: '&H00FFFFFF', outlineColor: '&H00000000', outline: 3, shadow: 3 },
  neon:    { fontname: 'Arial', fontsize: 64, bold: true, primaryColor: '&H0000FF00', outlineColor: '&H00FF00FF', outline: 2, shadow: 0 },
  minimal: { fontname: 'Helvetica', fontsize: 56, bold: false, primaryColor: '&H00FFFFFF', outlineColor: '&H00000000', outline: 2, shadow: 1 },
  impact:  { fontname: 'Impact', fontsize: 80, bold: true, primaryColor: '&H00FFFFFF', outlineColor: '&H000000FF', outline: 4, shadow: 2 },
};

function toASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2,'0')}:${s.toFixed(2).padStart(5,'0')}`;
}

function generateASS(wordTimestamps, captionSettings = {}, clipStartTime = 0) {
  const styleName = (captionSettings.style || 'hormozi').toLowerCase();
  const style = STYLES[styleName] || STYLES.hormozi;
  const wordsPerLine = captionSettings.wordsPerLine || 4;
  const position = captionSettings.position || 'bottom';

  const alignment = position === 'top' ? 8 : position === 'middle' ? 5 : 2;

  let header = `[Script Info]
Title: Viral Studio Pro Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${style.fontname},${style.fontsize},${style.primaryColor},&H000000FF,${style.outlineColor},&H00000000,${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${alignment},40,40,60,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

  // Group words into lines
  const lines = [];
  for (let i = 0; i < wordTimestamps.length; i += wordsPerLine) {
    const chunk = wordTimestamps.slice(i, i + wordsPerLine);
    const lineStart = chunk[0].start - clipStartTime;
    const lineEnd = chunk[chunk.length - 1].end - clipStartTime;

    // Build karaoke text with \kf tags
    let text = '';
    for (const w of chunk) {
      const dur = Math.round((w.end - w.start) * 100);
      text += `{\\kf${dur}}${w.word} `;
    }

    if (lineStart >= 0) {
      lines.push(`Dialogue: 0,${toASSTime(Math.max(0, lineStart))},${toASSTime(lineEnd)},Default,,0,0,0,,${text.trim()}`);
    }
  }

  return header + lines.join('\n') + '\n';
}

module.exports = { generateASS };
SUBJS

# Create Supabase client
cat > /opt/viral-studio/lib/supabase-client.js << 'SUPJS'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadFromSupabase(storagePath, destPath) {
  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUrl(storagePath, 3600);

  if (error) throw new Error(`Supabase signed URL error: ${error.message}`);

  return new Promise((resolve, reject) => {
    const url = data.signedUrl;
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        client.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(destPath); });
        }).on('error', reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    }).on('error', reject);
  });
}

async function uploadToSupabase(filePath, storagePath) {
  const fileBuffer = fs.readFileSync(filePath);

  const { data, error } = await supabase.storage
    .from('clips')
    .upload(storagePath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });

  if (error) throw new Error(`Upload error: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('clips')
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

async function updateClipStatus(clipId, status, storagePath) {
  const { error } = await supabase
    .from('clips')
    .update({
      status,
      storage_path: storagePath,
      updated_at: new Date().toISOString()
    })
    .eq('id', clipId);

  if (error) console.error(`DB update error: ${error.message}`);
}

module.exports = { downloadFromSupabase, uploadToSupabase, updateClipStatus };
SUPJS

# Install npm dependencies
echo "📦 Installing npm packages..."
cd /opt/viral-studio
npm install --production 2>&1 | tail -3

# Open firewall port
echo "🔥 Opening port 3100..."
ufw allow 3100/tcp 2>/dev/null || true

# Start with PM2
echo "🚀 Starting API with PM2..."
cd /opt/viral-studio
pm2 start ecosystem.config.js
pm2 save
pm2 startup 2>/dev/null || true

# Wait and check
sleep 2
echo ""
echo "============================================"
echo "✅ VIRAL STUDIO RENDER API IS LIVE!"
echo "============================================"
echo "  URL:     http://37.27.190.229:3100"
echo "  Health:  http://37.27.190.229:3100/api/health"
echo "  API Key: vsp-render-secret-2026"
echo ""
echo "  PM2 status:"
pm2 list
echo ""
echo "  Test: curl http://37.27.190.229:3100/api/health"
echo "============================================"
