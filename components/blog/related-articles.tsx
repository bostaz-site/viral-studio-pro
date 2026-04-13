import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface RelatedArticle {
  slug: string
  title: string
  excerpt: string
  readTime: string
}

const ALL_ARTICLES: RelatedArticle[] = [
  {
    slug: 'creer-clips-viraux-twitch-guide-2026',
    title: 'Comment créer des clips viraux depuis Twitch en 2026',
    excerpt: 'Split-screen, sous-titres karaoké, score viral IA : le guide complet.',
    readTime: '8 min',
  },
  {
    slug: 'split-screen-subway-surfers-pourquoi-ca-marche',
    title: 'Split-screen Subway Surfers : pourquoi ça explose',
    excerpt: 'La science du dual-stimulus et les chiffres de rétention.',
    readTime: '6 min',
  },
  {
    slug: 'alternative-opusclip-eklipse-2026',
    title: 'Alternative à OpusClip et Eklipse en 2026',
    excerpt: 'Comparatif complet : features, prix, et verdict.',
    readTime: '7 min',
  },
]

/**
 * Shows related articles at the bottom of a blog post.
 * Pass the current slug to exclude the current article from the list.
 */
export function RelatedArticles({ currentSlug }: { currentSlug: string }) {
  const others = ALL_ARTICLES.filter((a) => a.slug !== currentSlug)
  if (others.length === 0) return null

  return (
    <section className="mt-14 pt-8 border-t border-border/40">
      <h2 className="text-lg font-bold mb-4">Articles similaires</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {others.map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="group rounded-xl border border-border bg-card/40 p-5 hover:border-primary/30 transition-colors"
          >
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors mb-1.5 leading-snug">
              {article.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {article.excerpt}
            </p>
            <span className="text-[11px] text-primary font-medium flex items-center gap-1 group-hover:underline">
              Lire · {article.readTime} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
