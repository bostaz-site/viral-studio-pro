'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function RefPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const handle = params?.handle as string | undefined

  useEffect(() => {
    if (!handle) {
      router.push('/')
      return
    }

    const utm_source = searchParams?.get('utm_source') ?? undefined
    const utm_medium = searchParams?.get('utm_medium') ?? undefined
    const utm_campaign = searchParams?.get('utm_campaign') ?? undefined

    // Set cookie for 30 days
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    document.cookie = `ref=${encodeURIComponent(handle)};path=/;expires=${expires.toUTCString()};SameSite=Lax`

    if (utm_source) {
      document.cookie = `ref_utm_source=${encodeURIComponent(utm_source)};path=/;expires=${expires.toUTCString()};SameSite=Lax`
    }
    if (utm_medium) {
      document.cookie = `ref_utm_medium=${encodeURIComponent(utm_medium)};path=/;expires=${expires.toUTCString()};SameSite=Lax`
    }
    if (utm_campaign) {
      document.cookie = `ref_utm_campaign=${encodeURIComponent(utm_campaign)};path=/;expires=${expires.toUTCString()};SameSite=Lax`
    }

    // Track the click
    fetch('/api/referral/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        utm_source,
        utm_medium,
        utm_campaign,
      }),
    }).catch(() => {
      // Track failure is non-blocking
    })

    // Redirect to invite page
    router.push('/invite')
  }, [handle, searchParams, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
