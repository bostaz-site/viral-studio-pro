// TODO: Add rate limiting (brute force protection) — server-side middleware or Supabase rate limit
"use client"

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    searchParams?.get('error') ?? null
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const redirectTo = searchParams?.get('redirectTo')
    // Validate: must be a local path (single slash, not // or /\) to prevent open redirect
    const dest = redirectTo && /^\/(?![/\\])/.test(redirectTo) ? redirectTo : '/dashboard'
    router.push(dest)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl shadow-black/20 overflow-hidden">
      <div className="p-6 sm:p-8 space-y-1 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
        <p className="text-sm text-white/50">Sign in to access your studio</p>
      </div>
      <form onSubmit={handleLogin}>
        <div className="px-6 sm:px-8 space-y-4">
          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-white/40 uppercase tracking-wider">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="pl-10 h-11 text-base bg-black/30 border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-white/40 uppercase tracking-wider">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="pl-10 h-11 text-base bg-black/30 border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8 pt-6 flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 text-amber-950 font-semibold shadow-lg shadow-amber-500/20 rounded-xl"
            disabled={loading}
          >
            {loading ? (
              <><WolfLoader variant="spinner" size={16} mode="amber" className="mr-2" /> Signing in...</>
            ) : (
              <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
          <p className="text-sm text-white/50 text-center">
            No account yet?{' '}
            <Link href="/signup" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
              Create free account
            </Link>
          </p>
          <ForgotPassword />
        </div>
      </form>
    </div>
  )
}

function ForgotPassword() {
  const [open, setOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return
    setSending(true)
    setResetError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      })
      if (error) {
        setResetError(error.message)
        setSending(false)
        return
      }
      setSent(true)
    } catch (err) {
      console.error('[ForgotPassword] Reset request failed:', err)
      setResetError(
        err instanceof Error ? err.message : 'Network error — check your connection and try again.'
      )
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-white/30 hover:text-amber-400 transition-colors">
        Forgot your password?
      </button>
    )
  }

  if (sent) {
    return <p className="text-xs text-emerald-400 text-center">Check your email for a reset link.</p>
  }

  return (
    <div className="w-full space-y-1.5">
      <form onSubmit={handleReset} className="flex gap-2 items-center w-full">
        <Input
          type="email"
          placeholder="your@email.com"
          value={resetEmail}
          onChange={e => setResetEmail(e.target.value)}
          required
          className="h-8 text-base sm:text-xs flex-1 bg-black/30 border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20"
        />
        <Button type="submit" size="sm" variant="outline" className="h-8 text-xs border-white/10 hover:bg-white/5" disabled={sending}>
          {sending ? '...' : 'Reset'}
        </Button>
      </form>
      {resetError && <p className="text-xs text-red-400 text-center">{resetError}</p>}
    </div>
  )
}
