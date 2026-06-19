# Landing Page Hero Videos — Needed

The hero section uses a side-by-side before/after video demo. Currently using **placeholder fallbacks** (poster images with "Play demo" button). You need to produce and add the real videos.

## Videos to create

### 1. `public/videos/hero-before.mp4`
- **Content**: Raw 16:9 Twitch clip (no treatment)
- **Duration**: 15 seconds, looping
- **Resolution**: 1280x720 minimum
- **Format**: MP4 (H.264), web-optimized (faststart)
- **Audio**: Include original audio (plays muted by default, user can unmute)
- **Example**: A funny/hype streamer moment, raw VOD quality

### 2. `public/videos/hero-after.mp4`
- **Content**: Same clip processed by Viral Animal
- **Duration**: 15 seconds, looping (synced with before)
- **Resolution**: 1280x720 minimum (showing the 9:16 output in context)
- **Format**: MP4 (H.264), web-optimized
- **Audio**: Include enhanced audio
- **Must show**: Karaoke captions, split-screen gameplay, viral score badge
- **Key**: This must be genuinely impressive — mediocre output kills trust

### 3. `public/images/hero-before-poster.jpg`
- **Content**: First frame of the before video (or a representative screenshot)
- **Resolution**: 1280x720
- **Format**: JPEG, optimized (<100KB)
- Used as: `<video poster>` fallback + autoplay-blocked state

### 4. `public/images/hero-after-poster.jpg`
- **Content**: First frame of the after video (showing captions + split-screen)
- **Resolution**: 1280x720
- **Format**: JPEG, optimized (<100KB)

## FFmpeg command to optimize videos for web

```bash
# Optimize for web streaming (faststart + reasonable size)
ffmpeg -i raw-before.mp4 \
  -c:v libx264 -preset slow -crf 23 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -vf "scale=1280:720" \
  -t 15 \
  public/videos/hero-before.mp4

# Extract poster frame
ffmpeg -i public/videos/hero-before.mp4 \
  -vframes 1 -q:v 2 \
  public/images/hero-before-poster.jpg
```

## Where they're used

- `components/landing/hero-section.tsx` — `BeforeAfterVideoDemo` component
- Videos load lazily via IntersectionObserver (won't block LCP)
- If autoplay is blocked (iOS Safari, corporate WiFi), poster image shows with "Play demo" button

## Kill switch note

If the output video is not genuinely impressive, **remove the video entirely** and keep the current `ClipTransformAnimation` component instead. A mediocre demo destroys trust faster than no demo at all.
