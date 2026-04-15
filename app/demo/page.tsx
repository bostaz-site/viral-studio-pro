import type { Metadata } from 'next'
import { DemoExperience } from './demo-experience'

export const metadata: Metadata = {
  title: 'Démo interactive — teste sans créer de compte',
  description:
    'Essaie Viral Studio Pro en 30 secondes : change le style des sous-titres, active le split-screen, vois le score viral — sans signup.',
  openGraph: {
    title: 'Démo interactive — Viral Studio Pro',
    description: 'Teste le produit en 30 secondes, sans signup.',
  },
  alternates: {
    canonical: 'https://viral-studio-pro.netlify.app/demo',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Démo interactive — Viral Studio Pro',
  description: 'Essaie Viral Studio Pro en 30 secondes : change le style des sous-titres, active le split-screen, vois le score viral — sans signup.',
  url: 'https://viral-studio-pro.netlify.app/demo',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Viral Studio Pro',
    url: 'https://viral-studio-pro.netlify.app',
  },
}

export default function DemoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DemoExperience />
    </>
  )
}
