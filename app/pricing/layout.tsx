import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Viral Studio Pro plans and pricing. Start free with 3 videos/month, or go Pro ($19, 30 clips/month) or Studio ($24 launch price instead of $29, 120 clips/month including 30 bonus).',
  openGraph: {
    title: 'Pricing — Viral Studio Pro',
    description: 'Viral clips at your scale. Free, Pro, or Studio plan.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Pricing — Viral Studio Pro',
  description: 'Viral Studio Pro plans and pricing.',
  url: 'https://viral-studio-pro.netlify.app/pricing',
  mainEntity: {
    '@type': 'Product',
    name: 'Viral Studio Pro',
    description: 'Tool to create viral clips from Twitch and YouTube Gaming streams.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: '3 videos/month, watermark, 1 format',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '19',
        priceCurrency: 'USD',
        billingIncrement: 1,
        description: '30 videos/month, no watermark, all platforms',
      },
      {
        '@type': 'Offer',
        name: 'Studio',
        price: '24',
        priceCurrency: 'USD',
        description: '120 videos/month, advanced analytics, scheduling',
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
