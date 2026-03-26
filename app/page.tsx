import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Viral Studio Pro — Transforme tes streams en clips viraux avec l\'IA',
  description: 'Crée des clips viraux à partir de streams Twitch et YouTube Gaming. Sous-titres karaoké, split-screen Subway Surfers/Minecraft, score viral IA. Export TikTok, Reels, Shorts en 1 clic.',
  openGraph: {
    title: 'Viral Studio Pro — Clips viraux depuis tes streams',
    description: 'Sous-titres karaoké + split-screen + score viral IA. Le seul outil avec split-screen automatique (Subway Surfers, Minecraft).',
  },
}

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LandingPage />
}
