'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 bg-background text-foreground">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">
          Unexpected Error
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          A critical error occurred. Please refresh the page.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
        >
          <Home className="w-4 h-4" />
          Home
        </Link>
      </div>
    </div>
  )
}
