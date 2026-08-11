import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Archivo_Black } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import './rank-cards.css'
import './landing-v3.css'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const archivoBlack = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-score' })

const siteUrl = 'https://viralanimal.com'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

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
    title: 'Viral Animal — The radar finds clips blowing up. You post them in three clicks.',
    description: 'Browse Twitch & Kick clips scored by AI, add karaoke captions + split-screen, and post to TikTok in one click.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viral Animal — The radar finds clips blowing up',
    description: 'Browse Twitch & Kick clips scored by AI, add karaoke captions + split-screen, and post to TikTok in one click.',
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
  icons: {
    icon: [
      { url: '/favicon.svg?v=4', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png?v=4', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.svg?v=4',
    apple: '/icons/apple-touch-icon-180.png?v=4',
  },
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Viral Animal',
  url: siteUrl,
  logo: `${siteUrl}/favicon.svg`,
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
        <meta name="theme-color" content="#020617" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png?v=4" />
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
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
            },
          }}
          icons={{
            success: <span style={{ color: '#f59e0b' }}>&#10003;</span>,
          }}
        />
        {/* SW registration REMOVED — browsers with the old SW will auto-check
            /sw.js on navigation (existing registration triggers update check).
            New visitors never register a SW at all. */}
      </body>
    </html>
  )
}
