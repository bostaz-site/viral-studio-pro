import type { Metadata } from 'next'
import { DemoExperience } from './demo-experience'

export const metadata: Metadata = {
  title: 'Interactive demo — try without signup',
  description:
    'Try Viral Studio Pro in 30 seconds: change caption styles, enable split-screen, see viral score — no signup required.',
  openGraph: {
    title: 'Interactive demo — Viral Studio Pro',
    description: 'Try the product in 30 seconds, no signup.',
  },
  alternates: {
    canonical: 'https://viral-studio-pro.netlify.app/demo',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Interactive demo — Viral Studio Pro',
  description: 'Try Viral Studio Pro in 30 seconds: change caption styles, enable split-screen, see viral score — no signup required.',
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
