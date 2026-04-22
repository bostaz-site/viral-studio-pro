'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console in development, or to a monitoring service in prod
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          An error occurred. Try refreshing the page.
          If the problem persists, contact support.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Code: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCcw className="w-4 h-4" />
        Try again
      </Button>
    </div>
  )
}
