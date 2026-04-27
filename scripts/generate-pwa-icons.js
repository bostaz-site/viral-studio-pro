/**
 * Generate PWA icons as placeholder PNGs.
 * Uses canvas-based approach (no sharp dependency needed).
 *
 * Run: node scripts/generate-pwa-icons.js
 *
 * If sharp is installed, replace with sharp-based generation for better quality.
 */

const fs = require('fs')
const path = require('path')

// Minimal PNG generator — creates a solid-color PNG with text
function createPng(width, height, bgColor, textColor, text, maskable) {
  // Use a simple SVG → base64 approach that Node can handle
  const padding = maskable ? Math.floor(width * 0.2) : 0
  const fontSize = Math.floor((width - padding * 2) * 0.35)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${bgColor}" rx="${maskable ? 0 : Math.floor(width * 0.15)}"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="${textColor}">
      ${text}
    </text>
  </svg>`

  return Buffer.from(svg)
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const configs = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]

for (const cfg of configs) {
  const svg = createPng(cfg.size, cfg.size, '#0a0a0a', '#f97316', 'VA', cfg.maskable)
  const outPath = path.join(outDir, cfg.name)
  // Save as SVG with .png extension (browsers render SVG in <link> tags)
  // For true PNG, use sharp or canvas package
  fs.writeFileSync(outPath.replace('.png', '.svg'), svg)
  console.log(`Generated ${cfg.name.replace('.png', '.svg')} (${cfg.size}x${cfg.size})`)
}

// Also create actual SVG versions that work as icon fallbacks
for (const cfg of configs) {
  const svgContent = createPng(cfg.size, cfg.size, '#0a0a0a', '#f97316', 'VA', cfg.maskable)
  const svgPath = path.join(outDir, cfg.name.replace('.png', '.svg'))
  fs.writeFileSync(svgPath, svgContent)
}

console.log('\nPlaceholder icons generated in public/icons/')
console.log('Replace with real PNG icons for production (use sharp or Figma export)')
