"use client"

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // 1. Listen for PASSWORD_RECOVERY event FIRST (before any async work)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // 2. Fallback: if there's a ?code= param (direct PKCE, not via /auth/callback),
    //    exchange it client-side
    const code = searchParams?.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          console.error('[reset] Code exchange failed:', exchangeError.message)
          setError('This reset link is invalid or has expired. Please request a new one.')
        }
        // PASSWORD_RECOVERY event will fire from the exchange above → sets ready
      })
    } else {
      // 3. No code param — we arrived here from /auth/callback (session already set).
      //    Check if we have a valid session.
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setReady(true)
        } else {
          setError('No active reset session. Please request a new password reset link.')
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      console.error('[reset] Password update failed:', updateError.message)
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#020617' }}>
      <Card className="w-full max-w-sm bg-card/80 border-border">
        <CardHeader className="pb-2">
          <h2 className="text-xl font-bold tracking-tight">Reset your password</h2>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-muted-foreground">Password updated. Redirecting...</p>
            </div>
          ) : error && !ready ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400 text-center">{error}</p>
              <Link
                href="/login"
                className="text-sm text-amber-400 hover:text-amber-300 font-semibold transition-colors"
              >
                Back to login
              </Link>
            </div>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground py-4">Verifying your reset link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="pl-10 h-11" placeholder="At least 8 characters" autoComplete="new-password" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} className="pl-10 h-11" placeholder="Same password again" autoComplete="new-password" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
