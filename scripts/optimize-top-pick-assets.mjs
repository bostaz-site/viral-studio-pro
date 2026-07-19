/**
 * Optimize Top Pick frame assets: PNG → WebP with resize.
 * Crown: 170px wide, corners: 130px wide, quality 85.
 * Run: node scripts/optimize-top-pick-assets.mjs
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const framesDir = join(__dirname, '..', 'public', 'frames')

const assets = [
  { src: 'top-pick-crown.png', out: 'top-pick-crown.webp', width: 170 },
  { src: 'corner-tl.png', out: 'corner-tl.webp', width: 130 },
  { src: 'corner-tr.png', out: 'corner-tr.webp', width: 130 },
  { src: 'corner-bl.png', out: 'corner-bl.webp', width: 130 },
  { src: 'corner-br.png', out: 'corner-br.webp', width: 130 },
]

for (const a of assets) {
  const input = join(framesDir, a.src)
  const output = join(framesDir, a.out)
  const info = await sharp(input)
    .resize({ width: a.width, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(output)
  console.log(`${a.src} → ${a.out}  (${info.width}x${info.height}, ${(info.size / 1024).toFixed(1)}KB)`)
}
console.log('Done.')
