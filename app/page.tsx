import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'
import { isEffectiveAuditMode } from '@/lib/feature-flags.server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Viral Animal — Turn any clip into a TikTok banger',
  description: 'Browse Twitch & Kick clips, add karaoke captions + split-screen gameplay, and post to TikTok in one click. AI viral score, hook reordering, 9:16 export.',
  openGraph: {
    title: 'Viral Animal — Grab any clip, make it viral',
    description: 'Karaoke captions + split-screen + AI viral score. Browse Twitch & Kick clips, enhance, and post straight to TikTok.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Viral Animal',
  url: 'https://viralanimal.com',
  description: 'Browse Twitch & Kick clips, add karaoke captions + split-screen, and post to TikTok. AI viral score included.',
}

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const auditMode = await isEffectiveAuditMode()
    redirect(auditMode ? '/upload' : '/dashboard')
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
