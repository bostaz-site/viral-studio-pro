import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Viral Studio Pro to create viral clips from your streams.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
