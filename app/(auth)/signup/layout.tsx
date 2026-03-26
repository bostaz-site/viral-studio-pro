import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer un compte gratuit',
  description: 'Créez votre compte Viral Studio Pro gratuitement. 90 crédits offerts, aucune carte bancaire requise. Commencez à créer des clips viraux en 30 secondes.',
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
