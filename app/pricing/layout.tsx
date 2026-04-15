import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tarifs',
  description: 'Plans et tarifs Viral Studio Pro. Commencez gratuitement avec 3 vidéos/mois, ou passez Pro ($19, 30 clips/mois) ou Studio ($24 prix de lancement au lieu de $29, 120 clips/mois dont 30 bonus).',
  openGraph: {
    title: 'Tarifs — Viral Studio Pro',
    description: 'Des clips viraux à votre échelle. Plan Free, Pro ou Studio.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Tarifs — Viral Studio Pro',
  description: 'Plans et tarifs Viral Studio Pro.',
  url: 'https://viral-studio-pro.netlify.app/pricing',
  mainEntity: {
    '@type': 'Product',
    name: 'Viral Studio Pro',
    description: 'Outil de création de clips viraux à partir de streams Twitch et YouTube Gaming.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: '3 vidéos/mois, watermark, 1 format',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '19',
        priceCurrency: 'USD',
        billingIncrement: 1,
        description: '30 vidéos/mois, sans watermark, toutes plateformes',
      },
      {
        '@type': 'Offer',
        name: 'Studio',
        price: '24',
        priceCurrency: 'USD',
        description: '120 vidéos/mois, analytics avancé, scheduling',
      },
    ],
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
