'use client'

import { useEffect } from 'react'
import { RefreshCcw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { GlitchErrorScreen, GlitchPrimaryButton, GlitchSecondaryButton } from '@/components/ui/glitch-error-screen'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <GlitchErrorScreen
      code="ERR"
      label="Error / Signal lost"
      title="The stream dropped."
      message="Something broke on our side. A retry usually fixes it."
      actions={
        <>
          <GlitchPrimaryButton onClick={reset}>
            <RefreshCcw className="h-4 w-4" />
            Retry
          </GlitchPrimaryButton>
          <GlitchSecondaryButton onClick={() => router.push('/')}>
            <Home className="h-4 w-4" />
            Home
          </GlitchSecondaryButton>
        </>
      }
      footer={
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/25">
          Unexpected error{error?.digest ? ` — ${error.digest}` : ''}
        </p>
      }
    />
  )
}
