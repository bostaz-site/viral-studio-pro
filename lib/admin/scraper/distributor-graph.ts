/**
 * Detect competitor/related products promoted by a creator.
 * Returns product matches found in text (bio, descriptions, post titles).
 */

const PRODUCT_DATABASE: Array<{
  name: string
  category: string
  keywords: string[]
  bonus: number
}> = [
  // Direct competitors (ULTRA high intent) — +20
  { name: 'OpusClip', category: 'video_editing', keywords: ['opusclip', 'opus clip', 'opus.pro'], bonus: 20 },
  { name: 'Submagic', category: 'video_editing', keywords: ['submagic'], bonus: 20 },
  { name: 'Captions AI', category: 'video_editing', keywords: ['captions ai', 'captions.ai', 'captionsai'], bonus: 20 },
  { name: 'Vidyo.ai', category: 'video_editing', keywords: ['vidyo', 'vidyo.ai'], bonus: 20 },

  // Adjacent tools (high intent) — +15
  { name: 'Descript', category: 'video_editing', keywords: ['descript'], bonus: 15 },
  { name: 'CapCut', category: 'video_editing', keywords: ['capcut'], bonus: 15 },
  { name: 'Riverside', category: 'recording', keywords: ['riverside.fm', 'riverside'], bonus: 15 },

  // Productivity/AI tools (medium intent) — +10
  { name: 'Notion', category: 'productivity', keywords: ['notion.so', 'notion'], bonus: 10 },
  { name: 'Canva', category: 'design', keywords: ['canva'], bonus: 10 },
  { name: 'Loom', category: 'video', keywords: ['loom.com', 'useloom'], bonus: 10 },
  { name: 'Buffer', category: 'social_media', keywords: ['buffer'], bonus: 10 },
  { name: 'Later', category: 'social_media', keywords: ['later.com'], bonus: 10 },

  // Generic app review signals — +5
  { name: 'App Review', category: 'generic', keywords: ['app review', 'tool review', 'best apps', 'best tools'], bonus: 5 },
]

export interface ProductMatch {
  productName: string
  category: string
  evidenceText: string
  bonus: number
}

export function detectPromotedProducts(text: string): ProductMatch[] {
  const lower = text.toLowerCase()
  const matches: ProductMatch[] = []

  for (const product of PRODUCT_DATABASE) {
    for (const kw of product.keywords) {
      const idx = lower.indexOf(kw)
      if (idx !== -1) {
        const context = text.slice(Math.max(0, idx - 30), idx + kw.length + 30).trim()
        matches.push({
          productName: product.name,
          category: product.category,
          evidenceText: context,
          bonus: product.bonus,
        })
        break // one match per product is enough
      }
    }
  }

  return matches
}

/**
 * Calculate bonus score from detected products.
 */
export function distributorGraphBonus(matches: ProductMatch[]): number {
  if (matches.length === 0) return 0
  // Take the highest bonus from any match, cap at 30
  return Math.min(30, Math.max(...matches.map(m => m.bonus)))
}
