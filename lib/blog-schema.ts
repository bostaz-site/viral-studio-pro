/**
 * Generates JSON-LD Article structured data for blog posts.
 * Google uses this for rich results (author, date, headline).
 */
export interface BlogArticleMeta {
  slug: string
  title: string
  description: string
  datePublished: string  // ISO date yyyy-mm-dd
  dateModified?: string
  author: string
  readTimeMinutes: number
}

const BASE_URL = 'https://viral-studio-pro.netlify.app'
const PUBLISHER = {
  '@type': 'Organization',
  name: 'Viral Studio Pro',
  url: BASE_URL,
}

export function articleJsonLd(meta: BlogArticleMeta): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    url: `${BASE_URL}/blog/${meta.slug}`,
    datePublished: meta.datePublished,
    dateModified: meta.dateModified ?? meta.datePublished,
    author: {
      '@type': 'Person',
      name: meta.author,
    },
    publisher: PUBLISHER,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${meta.slug}`,
    },
    timeRequired: `PT${meta.readTimeMinutes}M`,
  }
}

export function blogIndexJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog — Viral Studio Pro',
    description:
      'Guides et astuces pour transformer tes streams Twitch et YouTube Gaming en clips viraux TikTok, Reels et Shorts.',
    url: `${BASE_URL}/blog`,
    publisher: PUBLISHER,
  }
}
