import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Viral Animal — Turn streams into viral clips with AI',
  description: 'Create viral clips from Twitch and YouTube Gaming streams. Karaoke captions, Subway Surfers/Minecraft split-screen, AI viral score. Export to TikTok, Reels, and Shorts in 1 click.',
  openGraph: {
    title: 'Viral Animal — Viral clips from your streams',
    description: 'Karaoke captions + split-screen + AI viral score. The only tool with automatic split-screen (Subway Surfers, Minecraft).',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Viral Animal',
  url: 'https://viralanimal.com',
  description: 'Create viral clips from Twitch and YouTube Gaming streams. Karaoke captions, split-screen, AI viral score.',
}

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
