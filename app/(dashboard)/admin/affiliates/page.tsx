'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AffiliatesDashboard } from '@/components/admin/affiliates-dashboard'

export default function AffiliatesAdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/dashboard'); return }
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          if (!d.isAdmin) { router.push('/dashboard'); return }
          setAuthorized(true)
          setLoading(false)
        })
        .catch(() => router.push('/dashboard'))
    })
  }, [router])

  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <AffiliatesDashboard />
}
