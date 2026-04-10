import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tarifs',
  description: 'Plans et tarifs Viral Studio Pro. Commencez gratuitement avec 3 vidéos/mois, ou passez Pro (29€, 50 clips/mois) ou Studio (79€, 300 clips/mois).',
  openGraph: {
    title: 'Tarifs — Viral Studio Pro',
    description: 'Des clips viraux à votre échelle. Plan Free, Pro ou Studio.',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
