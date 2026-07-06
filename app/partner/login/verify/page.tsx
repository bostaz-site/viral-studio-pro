'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { WolfLoader } from '@/components/ui/wolf-loader'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('t')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setError('No token provided'); return }
    window.location.href = `/api/partner/auth/verify?t=${token}`
  }, [token])

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center space-y-4">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={() => router.push('/partner/login')} className="text-sm text-amber-400 hover:text-amber-300">Back to login</button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-24 text-center space-y-4">
      <WolfLoader variant="spinner" size={32} mode="amber" />
      <p className="text-sm text-zinc-400">Verifying your login link...</p>
    </div>
  )
}

export default function PartnerVerifyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center mt-24"><WolfLoader variant="spinner" size={24} mode="amber" /></div>}>
      <VerifyContent />
    </Suspense>
  )
}
