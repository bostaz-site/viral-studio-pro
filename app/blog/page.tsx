import Link from 'next/link'
import { Scissors, ArrowRight, Clock, User } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — Guides et astuces pour créer des clips viraux',
  description: 'Tutoriels, guides et astuces pour transformer tes streams Twitch et YouTube Gaming en clips viraux TikTok, Reels et Shorts.',
}

const ARTICLES = [
  {
    slug: 'creer-clips-viraux-twitch-guide-2026',
    title: 'Comment créer des clips viraux depuis Twitch en 2026 — Le guide complet',
    excerpt: 'Split-screen, sous-titres karaoké, score viral IA : toutes les techniques pour transformer tes meilleurs moments de stream en clips qui explosent sur TikTok.',
    date: '28 mars 2026',
    readTime: '8 min',
    author: 'Samy',
  },
  {
    slug: 'split-screen-subway-surfers-pourquoi-ca-marche',
    title: 'Split-screen Subway Surfers : pourquoi ça explose sur TikTok',
    excerpt: 'La science du dual-stimulus, les chiffres de rétention, et comment automatiser le format split-screen pour tes clips de stream.',
    date: '29 mars 2026',
    readTime: '6 min',
    author: 'Samy',
  },
  {
    slug: 'alternative-opusclip-eklipse-2026',
    title: 'Alternative à OpusClip et Eklipse en 2026 — Comparatif complet',
    excerpt: 'Comparatif détaillé des 3 outils de clips automatiques. Split-screen, sous-titres, score viral, prix — on compare tout.',
    date: '30 mars 2026',
    readTime: '7 min',
    author: 'Samy',
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL STUDIO
            </span>
          </Link>
          <Link href="/signup" className="text-sm font-medium text-primary hover:underline">
            Essai gratuit
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Blog</h1>
        <p className="text-muted-foreground mb-10">Guides et astuces pour créer des clips viraux depuis tes streams</p>

        <div className="space-y-6">
          {ARTICLES.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`}>
              <article className="group rounded-xl border border-border bg-card/60 p-6 hover:border-primary/30 transition-colors">
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">{article.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{article.excerpt}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><User className="h-3 w-3" /> {article.author}</div>
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {article.readTime}</div>
                  <span>{article.date}</span>
                  <span className="ml-auto text-primary font-medium flex items-center gap-1 group-hover:underline">
                    Lire <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Viral Studio Pro</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Tarifs</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
