# Deployment Checklist

Complete guide for deploying Viral Animal Render API to production.

## Pre-Deployment

### 1. Server Preparation

- [ ] Provision Hetzner VPS (Ubuntu 24.04, minimum 4GB RAM, 50GB SSD)
- [ ] Configure SSH key authentication
- [ ] Configure firewall (UFW)
  ```bash
  ufw allow 22/tcp  # SSH
  ufw allow 80/tcp  # HTTP
  ufw allow 443/tcp # HTTPS
  ufw enable
  ```
- [ ] Update system
  ```bash
  sudo apt-get update && sudo apt-get upgrade -y
  ```
- [ ] Create non-root user (if needed)
  ```bash
  adduser deployer
  usermod -aG sudo deployer
  ```

### 2. Clone Repository

```bash
git clone <repo-url> /opt/viral-studio
cd /opt/viral-studio
git branch production
git checkout production
```

### 3. Create Directories

```bash
sudo mkdir -p /opt/viral-studio/{tmp,output}
sudo mkdir -p /var/log/viral-studio
sudo mkdir -p /var/run/viral-studio
sudo chown -R app:app /opt/viral-studio
sudo chown -R app:app /var/log/viral-studio
sudo chown -R app:app /var/run/viral-studio
```

## Installation

### 4. Run Setup Script

```bash
cd /opt/viral-studio
sudo bash setup.sh
```

The script will:
- Install FFmpeg, yt-dlp, Node.js, PM2
- Create app user
- Create directories
- Install dependencies
- Configure PM2
- Setup auto-start

### 5. Configure Environment

```bash
sudo nano /opt/viral-studio/.env
```

Set these variables:

```env
# Server
PORT=3100
NODE_ENV=production

# API Authentication (generate strong random string)
API_SECRET=<use: openssl rand -base64 32>

# Supabase (from your Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Settings > API > Service Role Key>

# File Paths
TEMP_DIR=/opt/viral-studio/tmp
OUTPUT_DIR=/opt/viral-studio/output

# FFmpeg/yt-dlp paths
FFMPEG_PATH=ffmpeg
YTDLP_PATH=yt-dlp

# Limits
MAX_RENDER_TIME_SECONDS=300
MAX_FILE_SIZE_BYTES=2147483648
```

## Verification

### 6. Test Installation

```bash
# Check system dependencies
ffmpeg -version | head -1
yt-dlp --version
node --version
pm2 --version

# Check Node dependencies
npm list

# Verify directories
ls -la /opt/viral-studio/
```

### 7. Start Application

```bash
cd /opt/viral-studio
pm2 start ecosystem.config.js --name "viral-studio-api"
pm2 save
```

### 8. Health Check

```bash
# Direct API test
curl http://localhost:3100/api/health

# Should return:
# {"status":"healthy",...}

# View logs
pm2 logs viral-studio-api
```

## Network Configuration

### 9. Reverse Proxy Setup (Nginx)

Install Nginx:
```bash
sudo apt-get install -y nginx
```

Create config `/etc/nginx/sites-available/viral-studio-api`:
```nginx
upstream viral_studio_api {
    server localhost:3100;
    keepalive 64;
}

server {
    listen 80;
    server_name api.viral-studio-pro.com;
    client_max_body_size 2G;

    location / {
        proxy_pass http://viral_studio_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }

    # Health check (no auth required)
    location /api/health {
        proxy_pass http://viral_studio_api;
        access_log off;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/viral-studio-api \
           /etc/nginx/sites-enabled/viral-studio-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 10. SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx

sudo certbot certonly --nginx \
  -d api.viral-studio-pro.com \
  --email admin@viral-studio-pro.com \
  --agree-tos

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

Update Nginx config to use SSL:
```nginx
# Add after "listen 80" line:
listen 443 ssl http2;
ssl_certificate /etc/letsencrypt/live/api.viral-studio-pro.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.viral-studio-pro.com/privkey.pem;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.viral-studio-pro.com;
    return 301 https://$server_name$request_uri;
}
```

Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Database & Integration

### 11. Verify Supabase Connection

```bash
# From the server, test Supabase connectivity
curl -X GET "https://your-project.supabase.co/rest/v1/clips?limit=1" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"

# Should return either data or empty array, not an error
```

### 12. Test Rendering Pipeline

Use curl to test the full render endpoint:

```bash
# Get a test clip ID from your database
CLIP_ID="550e8400-e29b-41d4-a716-446655440000"
API_SECRET="your-api-secret"

curl -X POST http://localhost:3100/api/render \
  -H "x-api-key: $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "clipId": "'$CLIP_ID'",
    "settings": {
      "captions": {
        "enabled": true,
        "style": "hormozi"
      },
      "format": {
        "aspectRatio": "9:16"
      },
      "branding": {
        "watermark": true
      }
    }
  }'
```

Monitor logs:
```bash
pm2 logs viral-studio-api
```

## Monitoring & Maintenance

### 13. Setup Monitoring

Health check endpoint (accessible without auth):
```bash
curl https://api.viral-studio-pro.com/api/health
```

Setup external monitoring (Better Uptime, Pingdom, etc.):
- Endpoint: `https://api.viral-studio-pro.com/api/health`
- Interval: 5 minutes
- Expected: 200 status, "healthy" in response

### 14. Log Rotation

Create `/etc/logrotate.d/viral-studio`:

```
/var/log/viral-studio/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 app app
    sharedscripts
}
```

Test log rotation:
```bash
sudo logrotate -f /etc/logrotate.d/viral-studio
```

### 15. Disk Space Management

Monitor disk usage:
```bash
# Check space
df -h /opt/viral-studio

# Cleanup old temp files (older than 7 days)
find /opt/viral-studio/tmp -type f -mtime +7 -delete
```

Setup cron job to clean up:
```bash
sudo crontab -e

# Add this line:
0 3 * * * find /opt/viral-studio/tmp -type f -mtime +7 -delete
```

### 16. Backup Configuration

Backup `.env` file regularly (store securely):
```bash
# Backup to secure location
tar czf ~/backup/viral-studio-env-$(date +%Y%m%d).tar.gz \
  /opt/viral-studio/.env

# Keep recent backups only
find ~/backup -name "viral-studio-*.tar.gz" -mtime +30 -delete
```

## Testing

### 17. Load Testing

Test with Apache Bench:
```bash
# Install
apt-get install apache2-utils

# Test health endpoint (no auth)
ab -n 100 -c 10 https://api.viral-studio-pro.com/api/health

# Test render endpoint
for i in {1..5}; do
  curl -X POST https://api.viral-studio-pro.com/api/render \
    -H "x-api-key: $API_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"clipId":"test-id-'$i'","settings":{}}' &
done
```

### 18. Error Scenarios

Test error handling:

```bash
# Missing API key
curl -X POST https://api.viral-studio-pro.com/api/render \
  -H "Content-Type: application/json" \
  -d '{"clipId":"test"}'
# Should return 401 Unauthorized

# Invalid clip ID
curl -X POST https://api.viral-studio-pro.com/api/render \
  -H "x-api-key: $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"clipId":"invalid-uuid"}'
# Should return error response

# Health check without auth
curl https://api.viral-studio-pro.com/api/health
# Should return 200 with status
```

## Post-Deployment

### 19. Documentation

- [ ] Document server IP and access details
- [ ] Document API secret storage location
- [ ] Create runbook for common operations
- [ ] Document monitoring alerts

### 20. Team Notification

- [ ] Notify team that API is live
- [ ] Share API endpoint and documentation
- [ ] Provide API secret securely to frontend team
- [ ] Update infrastructure diagrams

## Maintenance Schedule

### Daily
- [ ] Monitor disk space
- [ ] Check error logs for issues

### Weekly
- [ ] Review performance metrics
- [ ] Check system updates available

### Monthly
- [ ] Rotate API keys
- [ ] Backup configurations
- [ ] Review and optimize FFmpeg settings

### Quarterly
- [ ] Security audit
- [ ] Update dependencies
- [ ] Review and update documentation

## Rollback Plan

If something breaks after deployment:

```bash
# 1. Stop the current version
pm2 stop viral-studio-api

# 2. Revert to previous commit
cd /opt/viral-studio
git checkout main
git pull origin main

# 3. Reinstall dependencies
npm install

# 4. Restart
pm2 restart viral-studio-api

# 5. Verify
pm2 logs viral-studio-api
curl http://localhost:3100/api/health
```

## Troubleshooting Deployment

### Port already in use

```bash
# Find process using port 3100
lsof -i :3100

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3101
pm2 restart viral-studio-api
```

### Permission denied errors

```bash
# Fix permissions
sudo chown -R app:app /opt/viral-studio
sudo chmod -R 755 /opt/viral-studio/tmp
sudo chmod -R 755 /opt/viral-studio/output
```

### Out of memory errors

```bash
# Increase Node.js memory limit in ecosystem.config.js
node_args: '--max-old-space-size=2048'

# Restart
pm2 restart viral-studio-api
```

### FFmpeg not found

```bash
# Check installation
which ffmpeg
ffmpeg -version

# Reinstall
apt-get install --reinstall ffmpeg
```

## Success Criteria

After deployment, verify:

- [ ] API responds to health checks
- [ ] Render endpoint accepts requests
- [ ] Clips can be created and downloaded
- [ ] FFmpeg processes complete successfully
- [ ] Supabase integration working
- [ ] Logs are being written
- [ ] PM2 auto-restart is working
- [ ] SSL certificate is valid
- [ ] Monitoring alerts are configured

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Environment:** Production
**Status:** ☐ Successful ☐ Failed

**Notes:** ________________________________________________

