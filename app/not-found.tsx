'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, ArrowLeft } from 'lucide-react'
import { GlitchErrorScreen, GlitchPrimaryButton, GlitchSecondaryButton } from '@/components/ui/glitch-error-screen'

export default function NotFound() {
  const router = useRouter()
  return (
    <GlitchErrorScreen
      code="404"
      label="Error / Page not found"
      title="This page got clipped."
      message="The link might be broken or the page moved. But your next viral clip is right here."
      actions={
        <>
          <GlitchPrimaryButton onClick={() => router.push('/')}>
            <Home className="h-4 w-4" />
            Go Home
          </GlitchPrimaryButton>
          <GlitchSecondaryButton onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </GlitchSecondaryButton>
        </>
      }
      footer={
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <Link href="/pricing" className="text-white/40 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/signup" className="text-white/40 hover:text-white transition-colors">
              Sign up
            </Link>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/25">
            HTTP 404 — Not Found
          </p>
        </div>
      }
    />
  )
}
