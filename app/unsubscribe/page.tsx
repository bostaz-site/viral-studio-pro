'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

type Status = 'loading' | 'success' | 'error'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('t')
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setStatus(res.ok ? 'success' : 'error')
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="w-full max-w-md text-center space-y-6">
      {status === 'loading' && (
        <>
          <WolfLoader variant="spinner" size={40} mode="amber" className="mx-auto" />
          <p className="text-muted-foreground">Processing your request...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">You've been unsubscribed</h1>
            <p className="text-muted-foreground mt-2">
              You will no longer receive emails from us. This change is effective immediately.
            </p>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground mt-2">
              This unsubscribe link may have expired or already been used.
              If you continue to receive emails, please contact{' '}
              <a href="mailto:support@viralanimal.com" className="text-primary underline">
                support@viralanimal.com
              </a>
            </p>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground/60 pt-4">
        Viral Animal &middot; Compliance
      </p>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={<WolfLoader variant="spinner" size={40} mode="amber" />}>
        <UnsubscribeContent />
      </Suspense>
    </div>
  )
}
