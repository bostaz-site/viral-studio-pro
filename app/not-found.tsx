import Link from 'next/link'
import { ArrowLeft, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {/* Glitch-style 404 */}
        <div className="relative mb-8">
          <p className="text-[120px] sm:text-[160px] font-black leading-none tracking-tighter bg-gradient-to-b from-foreground/20 to-foreground/5 bg-clip-text text-transparent select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 shadow-xl">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight mb-2">
          Cette page n&apos;existe pas
        </h1>
        <p className="text-muted-foreground mb-8">
          Le lien est peut-être cassé, ou la page a été déplacée.
          Mais ton prochain clip viral, lui, est juste là.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Accueil
            </Button>
          </Link>
          <Link href="/demo">
            <Button className="gap-2">
              <Sparkles className="h-4 w-4" />
              Voir la démo
            </Button>
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">Pages populaires</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Tarifs
            </Link>
            <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
            <Link href="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
