#!/bin/bash

# Viral Studio Pro Render API — VPS Setup Script
# Run this script to setup the render API on your Hetzner VPS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

INSTALL_DIR="/opt/viral-studio"
APP_USER="app"
APP_GROUP="app"
LOG_DIR="/var/log/viral-studio"
RUN_DIR="/var/run/viral-studio"

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

check_command() {
  if command -v "$1" &> /dev/null; then
    print_success "$1 is installed"
    return 0
  else
    print_error "$1 is not installed"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Checks
# ─────────────────────────────────────────────────────────────────────────────

print_header "Viral Studio Pro Render API — Setup"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
  print_error "This script must be run as root"
  exit 1
fi

# Check Ubuntu version
if ! grep -q "Ubuntu 24" /etc/os-release; then
  print_warning "This script is tested on Ubuntu 24.04. Your system may differ."
fi

# ─────────────────────────────────────────────────────────────────────────────
# System Updates
# ─────────────────────────────────────────────────────────────────────────────

print_header "Updating system packages"
apt-get update
apt-get upgrade -y
print_success "System updated"

# ─────────────────────────────────────────────────────────────────────────────
# Install Dependencies
# ─────────────────────────────────────────────────────────────────────────────

print_header "Installing dependencies"

# FFmpeg
if ! check_command ffmpeg; then
  print_warning "Installing FFmpeg..."
  apt-get install -y ffmpeg
fi

# FFprobe (usually comes with FFmpeg)
if ! check_command ffprobe; then
  print_warning "FFprobe not found, installing ffmpeg-tools..."
  apt-get install -y ffmpeg
fi

# yt-dlp
if ! check_command yt-dlp; then
  print_warning "Installing yt-dlp..."
  apt-get install -y python3-pip
  pip3 install --upgrade yt-dlp
fi

# Node.js 20
if ! check_command node; then
  print_warning "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  apt-get install -y nodejs
fi

# PM2 (global)
if ! npm list -g pm2 &>/dev/null; then
  print_warning "Installing PM2..."
  npm install -g pm2
else
  print_success "PM2 is installed"
fi

# Nginx (optional, for reverse proxy)
if ! check_command nginx; then
  print_warning "Would you like to install Nginx for reverse proxy? (y/n)"
  read -r response
  if [[ "$response" == "y" ]]; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
    print_success "Nginx installed and started"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Create System User
# ─────────────────────────────────────────────────────────────────────────────

print_header "Setting up application user"

if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
  print_success "Created user $APP_USER"
else
  print_success "User $APP_USER already exists"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Create Directories
# ─────────────────────────────────────────────────────────────────────────────

print_header "Creating application directories"

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/tmp"
mkdir -p "$INSTALL_DIR/output"
mkdir -p "$LOG_DIR"
mkdir -p "$RUN_DIR"

chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
chown -R "$APP_USER:$APP_GROUP" "$LOG_DIR"
chown -R "$APP_USER:$APP_GROUP" "$RUN_DIR"

chmod 755 "$INSTALL_DIR"
chmod 755 "$LOG_DIR"
chmod 755 "$RUN_DIR"

print_success "Created directories"

# ─────────────────────────────────────────────────────────────────────────────
# Clone/Copy Application
# ─────────────────────────────────────────────────────────────────────────────

print_header "Setting up application files"

if [ -d "$INSTALL_DIR/.git" ]; then
  print_warning "Git repository already exists, pulling latest..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  print_warning "Clone your repository to $INSTALL_DIR"
  print_warning "Example: git clone <repo-url> $INSTALL_DIR"
fi

# Copy VPS files into place (if running this from the repo)
if [ -d "vps" ]; then
  cp -r vps/* "$INSTALL_DIR/"
  print_success "Copied VPS files"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Install Node Dependencies
# ─────────────────────────────────────────────────────────────────────────────

print_header "Installing Node.js dependencies"

cd "$INSTALL_DIR"
npm install
print_success "Dependencies installed"

# ─────────────────────────────────────────────────────────────────────────────
# Environment Configuration
# ─────────────────────────────────────────────────────────────────────────────

print_header "Configuring environment"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  print_success "Created .env file from template"
  print_warning "⚠️  IMPORTANT: Edit $INSTALL_DIR/.env with your configuration"
  print_warning "  - Set API_SECRET to a strong random string"
  print_warning "  - Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
else
  print_success ".env file already exists"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PM2 Setup
# ─────────────────────────────────────────────────────────────────────────────

print_header "Configuring PM2"

cd "$INSTALL_DIR"

# Start the app with PM2
pm2 start ecosystem.config.js --name "viral-studio-api"
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd -u "$APP_USER" --hp /home/"$APP_USER"
print_success "PM2 configured for auto-start"

# ─────────────────────────────────────────────────────────────────────────────
# Firewall Configuration (optional)
# ─────────────────────────────────────────────────────────────────────────────

print_header "Firewall configuration"

if command -v ufw &> /dev/null; then
  print_warning "Would you like to configure UFW firewall? (y/n)"
  read -r response
  if [[ "$response" == "y" ]]; then
    ufw allow 22/tcp      # SSH
    ufw allow 80/tcp      # HTTP
    ufw allow 443/tcp     # HTTPS
    ufw allow 3100/tcp    # API (if not behind proxy)
    ufw enable
    print_success "Firewall configured"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Verification
# ─────────────────────────────────────────────────────────────────────────────

print_header "Verifying installation"

# Check FFmpeg
if check_command ffmpeg; then
  ffmpeg -version | head -1
fi

# Check yt-dlp
if check_command yt-dlp; then
  yt-dlp --version
fi

# Check Node.js
if check_command node; then
  node --version
fi

# Check PM2
if check_command pm2; then
  pm2 --version
fi

# ─────────────────────────────────────────────────────────────────────────────
# Completion
# ─────────────────────────────────────────────────────────────────────────────

print_header "Setup complete!"

echo -e "${GREEN}"
echo "Next steps:"
echo "  1. Edit your environment configuration:"
echo "     ${INSTALL_DIR}/.env"
echo ""
echo "  2. Verify the application is running:"
echo "     pm2 status"
echo ""
echo "  3. Check logs:"
echo "     pm2 logs viral-studio-api"
echo ""
echo "  4. Start/stop the application:"
echo "     pm2 start viral-studio-api"
echo "     pm2 stop viral-studio-api"
echo ""
echo "  5. Test the health endpoint:"
echo "     curl http://localhost:3100/api/health"
echo -e "${NC}"

print_success "Viral Studio Pro Render API is ready!"
