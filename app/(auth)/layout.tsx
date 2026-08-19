import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — Wolf pattern (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center"
        style={{ backgroundColor: '#020617' }}
      >
        {/* Wolf tile pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'url(/wolf-pattern-tile.png)',
            backgroundRepeat: 'repeat',
            backgroundSize: '260px 260px',
          }}
        />

        {/* Subtle amber vignette at bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(245,158,11,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Content — centered wolf + wordmark */}
        <div className="relative z-10 flex flex-col items-center text-center px-8 animate-in fade-in duration-700">
          <Image
            src="/viral_animal_wolf_trace.svg"
            alt="Viral Animal"
            width={180}
            height={180}
            className="mb-8 drop-shadow-[0_0_40px_rgba(245,158,11,0.15)]"
            priority
          />

          <h1 className="text-3xl font-black tracking-tight leading-none mb-1">
            <span className="text-white">VIRAL</span>{' '}
            <span className="text-amber-400">ANIMAL</span>
          </h1>

          <p className="text-lg font-bold text-white/70 mt-3">
            More viral clips. Faster.
          </p>

          <p className="text-xs text-white/30 mt-6">
            No credit card &middot; 3 free clips per month
          </p>
        </div>
      </div>

      {/* Right panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Image
                src="/viral_animal_wolf_trace.svg"
                alt="Viral Animal"
                width={36}
                height={36}
              />
              <span className="text-xl font-black tracking-tight">
                <span className="text-white">VIRAL</span>{' '}
                <span className="text-amber-400">ANIMAL</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">More viral clips. Faster.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
