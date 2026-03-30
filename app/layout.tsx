import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const siteUrl = 'https://viral-studio-pro.netlify.app'

export const metadata: Metadata = {
  title: {
    default: 'Viral Studio Pro — Transforme tes streams en clips viraux avec l\'IA',
    template: '%s | Viral Studio Pro',
  },
  description: 'Crée des clips viraux à partir de streams Twitch et YouTube Gaming. Sous-titres karaoké, split-screen Subway Surfers/Minecraft, score viral IA. Export TikTok, Reels, Shorts en 1 clic.',
  keywords: ['clips viraux', 'twitch clips', 'stream clips', 'sous-titres karaoké', 'split-screen', 'tiktok', 'reels', 'shorts', 'viral', 'IA', 'gaming', 'streamer'],
  authors: [{ name: 'Viral Studio Pro' }],
  creator: 'Viral Studio Pro',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: siteUrl,
    siteName: 'Viral Studio Pro',
    title: 'Viral Studio Pro — Transforme tes streams en clips viraux',
    description: 'Crée des clips viraux à partir de streams Twitch et YouTube Gaming. Sous-titres karaoké, split-screen automatique, score viral IA.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viral Studio Pro — Clips viraux depuis tes streams',
    description: 'Sous-titres karaoké + split-screen + score viral IA. Export TikTok, Reels, Shorts en 1 clic.',
    creator: '@viralstudiopro',
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
  name: 'Viral Studio Pro',
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  founder: {
    '@type': 'Person',
    name: 'Samy',
  },
  sameAs: [
    'https://twitter.com/viralstudiopro',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@viralstudio.pro',
    contactType: 'customer service',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Viral Studio Pro',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  description: 'Crée des clips viraux à partir de streams Twitch et YouTube Gaming avec sous-titres karaoké, split-screen et score viral IA.',
  offers: [
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      name: 'Free',
      description: '3 vidéos par mois, 90 crédits offerts',
    },
    {
      '@type': 'Offer',
      price: '29',
      priceCurrency: 'EUR',
      name: 'Pro',
      description: '50 vidéos par mois, sans watermark, brand template',
    },
    {
      '@type': 'Offer',
      price: '79',
      priceCurrency: 'EUR',
      name: 'Studio',
      description: 'Vidéos illimitées, split-screen, distribution multi-plateforme',
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
    <html lang="fr" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <head>
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
