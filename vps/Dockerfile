FROM node:20-slim

# Install FFmpeg, FFprobe, and yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-dejavu-core \
      fonts-liberation \
      fonts-liberation2 \
      fonts-noto-core \
      fontconfig \
      python3 \
      python3-pip \
      curl \
      ca-certificates && \
    fc-cache -f -v && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    pip3 install --no-cache-dir --break-system-packages opencv-python-headless numpy && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory and broll directory
WORKDIR /opt/viral-studio
RUN mkdir -p /opt/viral-studio/broll /opt/viral-studio/tmp

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy server code
COPY . .

# Expose port
ENV PORT=3100
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3100/api/health || exit 1

CMD ["node", "server.js"]
