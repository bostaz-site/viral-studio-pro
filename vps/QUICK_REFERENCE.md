# Quick Reference

Common commands and operations for Viral Studio Pro Render API.

## Server Management

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs viral-studio-api

# Start/stop/restart
pm2 start viral-studio-api
pm2 stop viral-studio-api
pm2 restart viral-studio-api

# Delete from PM2
pm2 delete viral-studio-api

# Resurrect (restart all apps)
pm2 resurrect

# Update PM2 startup scripts
pm2 startup
pm2 save
```

## API Testing

```bash
# Health check (no auth)
curl http://localhost:3100/api/health

# Render clip
curl -X POST http://localhost:3100/api/render \
  -H "x-api-key: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "clipId": "clip-uuid",
    "settings": {
      "captions": {"enabled": true, "style": "hormozi"},
      "format": {"aspectRatio": "9:16"},
      "branding": {"watermark": true}
    }
  }'

# Get subtitle file
curl -X POST http://localhost:3100/api/render/caption \
  -H "x-api-key: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "wordTimestamps": [
      {"word": "Hello", "start": 0.5, "end": 1.2}
    ],
    "style": "hormozi"
  }' \
  -o captions.ass

# Download video
curl -X POST http://localhost:3100/api/download \
  -H "x-api-key: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=..."}'
```

## File Management

```bash
# Check disk space
df -h

# Check temp directory size
du -sh /opt/viral-studio/tmp

# Clean old temp files
rm -rf /opt/viral-studio/tmp/*

# View recent logs
tail -100 /var/log/viral-studio/api.out.log

# Search logs for errors
grep -i error /var/log/viral-studio/api.error.log | tail -20
```

## System Information

```bash
# Check FFmpeg
ffmpeg -version | head -1
which ffmpeg

# Check yt-dlp
yt-dlp --version
which yt-dlp

# Check Node.js
node --version
npm --version

# Check disk space details
df -h /opt/viral-studio

# Check memory usage
free -h

# Check CPU usage
top -b -n 1 | grep Cpu

# List open ports
netstat -tlnp | grep 3100
```

## Environment

```bash
# View current env (masked)
grep -v "^#" /opt/viral-studio/.env | grep -v "^$"

# Edit env
sudo nano /opt/viral-studio/.env

# Source env variables (for shell)
source /opt/viral-studio/.env

# Generate new API secret
openssl rand -base64 32
```

## Troubleshooting

```bash
# Check if port is in use
lsof -i :3100

# Find process using port
ss -tlnp | grep 3100

# Kill process by PID
kill -9 <PID>

# Test Supabase connection
curl -H "Authorization: Bearer SERVICE_KEY" \
  https://your-project.supabase.co/rest/v1/clips?limit=1

# Check FFmpeg availability
ffmpeg -h

# Test yt-dlp
yt-dlp -e "https://youtube.com/watch?v=dQw4w9WgXcQ"

# Monitor logs in real-time
tail -f /var/log/viral-studio/api.out.log

# View error logs
tail -f /var/log/viral-studio/api.error.log

# Restart with debug mode
NODE_ENV=development pm2 start server.js
```

## Performance Tuning

```bash
# Increase Node.js memory limit
# Edit ecosystem.config.js:
# node_args: '--max-old-space-size=2048'

# Check current FFmpeg performance
time ffmpeg -i input.mp4 -c:v libx264 -preset fast output.mp4

# Profile with PM2
pm2 monit

# Check system load
uptime

# View process list sorted by memory
ps aux --sort=-%mem | head -10

# View process list sorted by CPU
ps aux --sort=-%cpu | head -10
```

## Nginx Management (if used)

```bash
# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx

# View Nginx access logs
tail -f /var/log/nginx/access.log

# View Nginx error logs
tail -f /var/log/nginx/error.log

# Check which sites are enabled
ls /etc/nginx/sites-enabled/
```

## SSL/Certificate Management

```bash
# Check certificate expiration
openssl x509 -enddate -noout -in /etc/letsencrypt/live/domain/cert.pem

# List all certificates
certbot certificates

# Renew certificates
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Remove certificate
certbot delete --cert-name domain.com
```

## Database Operations

```bash
# Query clips (via supabase-cli if installed)
supabase query "SELECT id, status FROM clips LIMIT 10"

# Update clip status (via API call)
# Use the Supabase dashboard instead for manual updates

# Check database connection from server
curl -H "Authorization: Bearer YOUR_KEY" \
  https://your-project.supabase.co/rest/v1/clips?select=count&limit=1
```

## Deployment Operations

```bash
# Pull latest code
cd /opt/viral-studio && git pull origin main

# Install updated dependencies
npm install

# Restart with new code
pm2 restart viral-studio-api

# Check that it restarted
pm2 status
pm2 logs viral-studio-api

# Rollback to previous version
git revert HEAD
npm install
pm2 restart viral-studio-api
```

## Security

```bash
# Generate strong random secret
openssl rand -base64 32

# Generate password hash (for basic auth, if needed)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Check file permissions
ls -la /opt/viral-studio/.env

# Restrict env file access
chmod 600 /opt/viral-studio/.env
chown app:app /opt/viral-studio/.env

# Check recent failed SSH attempts
grep "Failed password" /var/log/auth.log | tail -5

# View current SSH keys
cat ~/.ssh/authorized_keys
```

## Monitoring

```bash
# Real-time monitoring
pm2 monit

# CPU and memory usage
pmw 1 # watch with 1 second interval

# Check system metrics
vmstat 1 5  # 5 samples every 1 second

# Disk I/O
iostat -x 1

# Network connections
ss -s
netstat -an | grep ESTABLISHED | wc -l

# Process tree (shows which process uses what)
pstree
```

## Useful Variables

```bash
# API endpoints
HEALTH_CHECK="http://localhost:3100/api/health"
RENDER_ENDPOINT="http://localhost:3100/api/render"
DOWNLOAD_ENDPOINT="http://localhost:3100/api/download"

# Directories
APP_DIR="/opt/viral-studio"
TEMP_DIR="/opt/viral-studio/tmp"
LOG_DIR="/var/log/viral-studio"
NGINX_CONFIG="/etc/nginx/sites-available/viral-studio-api"

# System
PM2_PID_FILE="/var/run/viral-studio-api.pid"
NODEJS_VERSION=$(node --version)
FFMPEG_VERSION=$(ffmpeg -version | head -1)
```

## Emergency Procedures

### Server is down
```bash
# Check if process is running
pm2 status

# Restart
pm2 restart viral-studio-api

# Check logs
pm2 logs viral-studio-api

# If still down, check system resources
free -h
df -h
top
```

### Out of disk space
```bash
# Find largest files/directories
du -sh /opt/viral-studio/* | sort -rh

# Clean temp directory
rm -rf /opt/viral-studio/tmp/*

# Or older files (>7 days)
find /opt/viral-studio/tmp -type f -mtime +7 -delete
```

### High CPU usage
```bash
# Find what's consuming CPU
top -o %CPU

# Check FFmpeg processes
ps aux | grep ffmpeg

# Limit Node.js to avoid runaway processes
# Stop current process
pm2 stop viral-studio-api

# Edit ecosystem.config.js to lower instances or add limits
# Restart
pm2 start viral-studio-api
```

### Memory leak
```bash
# Monitor memory growth
watch -n 5 'pm2 show viral-studio-api | grep memory'

# Restart if needed
pm2 restart viral-studio-api

# Check for long-running processes
ps aux --sort=-%mem
```

---

**Last Updated:** 2026-03-24
**API Version:** 1.0.0
