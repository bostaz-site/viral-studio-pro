import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à Viral Studio Pro pour créer des clips viraux à partir de vos streams.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
