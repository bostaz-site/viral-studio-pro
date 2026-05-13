import { Scissors } from 'lucide-react'
import type { Metadata } from 'next'
import { AuthClipsPanel } from '@/components/auth/clips-panel'

export const metadata: Metadata = {
  robots: { index: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — Clips showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-950 via-yellow-950 to-slate-950 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl" />

        <AuthClipsPanel />
      </div>

      {/* Right panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                <Scissors className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                VIRAL ANIMAL
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Create viral clips with AI</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
