import type { Metadata } from 'next'
import { DemoExperience } from './demo-experience'

export const metadata: Metadata = {
  title: 'Interactive demo — try without signup',
  description:
    'Try Viral Animal in 30 seconds: change caption styles, enable split-screen, see viral score — no signup required.',
  openGraph: {
    title: 'Interactive demo — Viral Animal',
    description: 'Try the product in 30 seconds, no signup.',
  },
  alternates: {
    canonical: 'https://viralanimal.com/demo',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Interactive demo — Viral Animal',
  description: 'Try Viral Animal in 30 seconds: change caption styles, enable split-screen, see viral score — no signup required.',
  url: 'https://viralanimal.com/demo',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Viral Animal',
    url: 'https://viralanimal.com',
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
