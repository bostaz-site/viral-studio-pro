import type { Metadata } from 'next'
import { Inter, Archivo_Black } from 'next/font/google'
import './globals.css'
import './rank-cards.css'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const archivoBlack = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-score' })

const siteUrl = 'https://viralanimal.com'

export const metadata: Metadata = {
  verification: {
    google: 'vd6ilqum2N1Q0YUJDWzxuyD_Nlv7Km5CfkwRB4Xl5L4',
  },
  title: {
    default: 'Viral Animal — Turn your streams into viral clips with AI',
    template: '%s | Viral Animal',
  },
  description: 'Create viral clips from Twitch and YouTube Gaming streams. Karaoke captions, Subway Surfers/Minecraft split-screen, AI viral score. Export to TikTok, Reels, Shorts in 1 click.',
  keywords: ['viral clips', 'Twitch clips', 'stream clips', 'karaoke captions', 'split-screen', 'TikTok clips', 'YouTube Gaming', 'viral clip maker', 'AI', 'gaming', 'streamer'],
  authors: [{ name: 'Viral Animal' }],
  creator: 'Viral Animal',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Viral Animal',
    title: 'Viral Animal — Turn your streams into viral clips',
    description: 'Create viral clips from Twitch and YouTube Gaming streams. Karaoke captions, automatic split-screen, AI viral score.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viral Animal — Viral clips from your streams',
    description: 'Karaoke captions + split-screen + AI viral score. Export to TikTok, Reels, Shorts in 1 click.',
    creator: '@viralanimal',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Viral Animal',
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  founder: {
    '@type': 'Person',
    name: 'Samy',
  },
  sameAs: [
    'https://twitter.com/viralanimal',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@viralanimal.com',
    contactType: 'customer service',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Viral Animal',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  description: 'Create viral clips from Twitch and YouTube Gaming streams with karaoke captions, split-screen, and AI viral score.',
  offers: [
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      name: 'Free',
      description: '3 videos per month, watermark, 1 platform',
    },
    {
      '@type': 'Offer',
      price: '19',
      priceCurrency: 'USD',
      name: 'Pro',
      description: '30 videos per month, clips up to 2 min, no watermark, brand template',
    },
    {
      '@type': 'Offer',
      price: '24',
      priceCurrency: 'USD',
      name: 'Studio',
      description: 'Launch price $24 (instead of $29). 120 videos per month (90 + 30 bonus), split-screen, multi-platform distribution',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '5',
    bestRating: '5',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable, archivoBlack.variable)}>
      <head>
        <meta name="google-site-verification" content="vd6ilqum2N1Q0YUJDWzxuyD_Nlv7Km5CfkwRB4Xl5L4" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className={`bg-background text-foreground antialiased dark`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
