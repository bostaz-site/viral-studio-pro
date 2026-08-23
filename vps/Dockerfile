FROM node:22-slim

# yt-dlp version — bump this to force a rebuild with a newer extractor when
# Twitch/YouTube change their APIs. Using `latest` without a cache-buster
# means Docker layer caching can pin us to an old yt-dlp for months.
ARG YT_DLP_VERSION=2026.07.04

# Install FFmpeg, FFprobe, and yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-dejavu-core \
      fonts-liberation \
      fonts-liberation2 \
      fonts-noto-core \
      fonts-noto-color-emoji \
      fontconfig \
      python3 \
      python3-pip \
      curl \
      ca-certificates \
      libglib2.0-0 \
      libgl1-mesa-glx && \
    fc-cache -f -v && \
    curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    /usr/local/bin/yt-dlp --version && \
    pip3 install --no-cache-dir --break-system-packages opencv-python-headless==4.10.0.84 numpy && \
    python3 -c "import cv2; cc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'); assert not cc.empty(), 'Haar cascade failed to load'; print('BUILD CHECK: OpenCV OK — CascadeClassifier + haarcascades verified')" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory and broll directory
WORKDIR /opt/viral-studio
RUN mkdir -p /opt/viral-studio/broll /opt/viral-studio/tmp

# Install custom Google Fonts (Montserrat, Inter, Lora, Poppins) for caption styles
COPY fonts/ /usr/local/share/fonts/custom/
RUN fc-cache -f -v

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
