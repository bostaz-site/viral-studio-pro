'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

function PartnerLoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await fetch('/api/partner/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
        <h1 className="text-xl font-semibold text-zinc-100">Check your email</h1>
        <p className="text-sm text-zinc-400">
          If an active partner account exists for <strong className="text-zinc-200">{email}</strong>,
          we've sent a login link. It expires in 30 days.
        </p>
        <button onClick={() => { setSent(false); setEmail('') }} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
          Try a different email
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-24">
      <div className="text-center mb-8">
        <Mail className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-xl font-semibold text-zinc-100">Partner Login</h1>
        <p className="text-sm text-zinc-400 mt-1">Enter your email to receive a magic login link.</p>
      </div>
      {errorParam && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">
            {errorParam === 'expired' ? 'Link expired. Please request a new one.' : 'Invalid link. Please try again.'}
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        <button type="submit" disabled={loading || !email.trim()} className="w-full bg-amber-500 text-black font-semibold py-3 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Login Link'}
        </button>
      </form>
      <p className="text-center text-xs text-zinc-500 mt-6">Only active Viral Animal partners can access this portal.</p>
    </div>
  )
}

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center mt-24"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>}>
      <PartnerLoginForm />
    </Suspense>
  )
}
