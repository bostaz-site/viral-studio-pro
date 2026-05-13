import Link from 'next/link'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'

export const metadata = {
  title: 'Viral Animal Partner Portal',
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/partner" className="flex items-center gap-2">
            <ViralAnimalLogo size={28} />
            <span className="text-sm font-semibold text-zinc-300">Partner Portal</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
