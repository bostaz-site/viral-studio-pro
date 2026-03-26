import { Scissors, Sparkles, TrendingUp, Zap } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — Branding / Features (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Scissors className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">VIRAL STUDIO</span>
            </div>
            <p className="text-lg text-blue-200/70 max-w-md leading-relaxed">
              Transformez vos longues vidéos en clips viraux optimisés pour TikTok, Reels et Shorts — propulsé par l&apos;IA.
            </p>
          </div>

          {/* Features list */}
          <div className="space-y-6">
            {[
              { icon: Zap, title: 'Découpe IA intelligente', desc: 'Claude analyse votre vidéo et détecte les meilleurs moments viraux.' },
              { icon: Sparkles, title: 'Sous-titres karaoké', desc: 'Styles pro (Hormozi, MrBeast, etc.) ajoutés automatiquement.' },
              { icon: TrendingUp, title: 'Score viral par clip', desc: 'Chaque clip reçoit un score 0-100 avec explication détaillée.' },
            ].map((feat) => (
              <div key={feat.title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <feat.icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{feat.title}</p>
                  <p className="text-sm text-blue-200/50 mt-0.5">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-16 pt-8 border-t border-white/5">
            <p className="text-xs text-blue-200/30 uppercase tracking-wider font-medium">
              Fait pour les créateurs qui veulent scaler
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Scissors className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                VIRAL STUDIO
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Créez des clips viraux avec l&apos;IA</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
