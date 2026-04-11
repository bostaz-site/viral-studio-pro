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

export default function DemoPage() {
  return <DemoExperience />
}
