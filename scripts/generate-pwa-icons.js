/**
 * Generate PWA/app icons from the Or Forge wolf favicon SVG.
 * Source of truth: SYSTEM-REFERENCE-BRAND-LOGO.md (path MICRO + goldForge)
 *
 * Run: node scripts/generate-pwa-icons.js
 * Requires: sharp (available via Next.js)
 *
 * Outputs to public/icons/:
 *   icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon-180.png
 */

const fs = require('fs')
const path = require('path')

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('sharp not found. Install it or run from a Next.js project with sharp available.')
  process.exit(1)
}

const WOLF_MICRO_PATH = 'M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z M 51.0 137.0 L 56.0 163.0 L 64.0 173.0 L 64.0 172.0 L 66.0 171.0 L 72.0 177.0 L 74.0 178.0 L 76.0 177.0 L 81.0 172.0 L 83.0 173.0 L 89.0 167.0 L 92.0 162.0 L 92.0 159.0 L 93.0 158.0 L 93.0 153.0 L 94.0 152.0 L 94.0 148.0 L 95.0 147.0 L 96.0 138.0 L 94.0 142.0 L 94.0 145.0 L 91.0 150.0 L 90.0 155.0 L 87.0 160.0 L 85.0 159.0 L 83.0 153.0 L 82.0 157.0 L 81.0 158.0 L 81.0 161.0 L 79.0 164.0 L 68.0 164.0 L 67.0 163.0 L 67.0 159.0 L 66.0 158.0 L 65.0 153.0 L 62.0 160.0 L 61.0 160.0 L 59.0 158.0 L 58.0 154.0 L 56.0 151.0 L 55.0 146.0 L 53.0 143.0 L 52.0 138.0 Z M 110.0 82.0 L 110.0 83.0 L 109.0 84.0 L 109.0 86.0 L 108.0 87.0 L 108.0 89.0 L 107.0 90.0 L 107.0 91.0 L 106.0 92.0 L 105.0 95.0 L 103.0 97.0 L 101.0 97.0 L 100.0 98.0 L 95.0 98.0 L 94.0 99.0 L 91.0 100.0 L 91.0 101.0 L 90.0 102.0 L 89.0 102.0 L 87.0 104.0 L 86.0 104.0 L 85.0 103.0 L 85.0 101.0 L 86.0 100.0 L 86.0 96.0 L 89.0 93.0 L 90.0 93.0 L 92.0 91.0 L 93.0 91.0 L 95.0 89.0 L 96.0 89.0 L 98.0 87.0 L 99.0 87.0 L 104.0 83.0 L 105.0 83.0 L 108.0 81.0 L 109.0 81.0 Z M 38.0 82.0 L 39.0 81.0 L 42.0 82.0 L 44.0 84.0 L 45.0 84.0 L 47.0 86.0 L 48.0 86.0 L 50.0 88.0 L 51.0 88.0 L 53.0 90.0 L 54.0 90.0 L 56.0 92.0 L 57.0 92.0 L 59.0 94.0 L 60.0 94.0 L 61.0 95.0 L 61.0 98.0 L 62.0 99.0 L 62.0 103.0 L 61.0 104.0 L 60.0 104.0 L 55.0 99.0 L 52.0 99.0 L 51.0 98.0 L 47.0 98.0 L 46.0 97.0 L 45.0 97.0 L 42.0 94.0 L 42.0 93.0 L 40.0 90.0 L 40.0 88.0 L 38.0 85.0 Z'

function makeSvg(size, maskable) {
  const padding = maskable ? Math.floor(size * 0.1) : Math.floor(size * 0.08)
  const innerSize = size - padding * 2
  // Scale wolf (149x183 viewBox) to fit innerSize keeping aspect ratio
  const scale = Math.min(innerSize / 149, innerSize / 183)
  const wolfW = 149 * scale
  const wolfH = 183 * scale
  const offsetX = (size - wolfW) / 2
  const offsetY = (size - wolfH) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="goldForge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FEF3C7"/>
      <stop offset="18%" stop-color="#FDE68A"/>
      <stop offset="42%" stop-color="#FBBF24"/>
      <stop offset="62%" stop-color="#D97706"/>
      <stop offset="84%" stop-color="#92400E"/>
      <stop offset="100%" stop-color="#78350F"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : Math.floor(size * 0.15)}" fill="url(#bg)"/>
  <g transform="translate(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}) scale(${scale.toFixed(4)})">
    <path fill="url(#goldForge)" fill-rule="evenodd" d="${WOLF_MICRO_PATH}"/>
  </g>
</svg>`
}

async function generate() {
  const outDir = path.join(__dirname, '..', 'public', 'icons')
  fs.mkdirSync(outDir, { recursive: true })

  const icons = [
    { name: 'icon-192.png', size: 192, maskable: false },
    { name: 'icon-512.png', size: 512, maskable: false },
    { name: 'icon-maskable-512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon-180.png', size: 180, maskable: false },
  ]

  for (const icon of icons) {
    const svg = makeSvg(icon.size, icon.maskable)
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
    const outPath = path.join(outDir, icon.name)
    fs.writeFileSync(outPath, pngBuffer)
    console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`)
  }

  console.log('\nDone! Icons written to public/icons/')
}

generate().catch(err => { console.error(err); process.exit(1) })
