"use client"

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Lock, User, ArrowRight, CheckCircle2, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

const REFERRAL_STORAGE_KEY = 'vsp:referral_code'

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupForm />
    </Suspense>
  )
}

function SignupSkeleton() {
  return (
    <Card className="bg-card/80 border-border backdrop-blur-sm shadow-xl shadow-black/5">
      <CardContent className="pt-8 pb-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)

  // Capture ref from URL param, cookie (set by /ref/[handle]), or localStorage
  useEffect(() => {
    const fromUrl = searchParams?.get('ref')?.trim().toUpperCase()
    if (fromUrl && /^[A-Z0-9_-]{2,30}$/i.test(fromUrl)) {
      setReferralCode(fromUrl)
      try {
        localStorage.setItem(REFERRAL_STORAGE_KEY, fromUrl)
      } catch {
        // localStorage disabled / private mode — carry on
      }
      return
    }
    // Check cookie set by /ref/[handle]
    try {
      const cookies = document.cookie.split(';').reduce<Record<string, string>>((acc, c) => {
        const [k, v] = c.trim().split('=')
        if (k && v) acc[k] = decodeURIComponent(v)
        return acc
      }, {})
      if (cookies.ref && /^[a-z0-9_-]{2,30}$/i.test(cookies.ref)) {
        const handle = cookies.ref.toUpperCase()
        setReferralCode(handle)
        try { localStorage.setItem(REFERRAL_STORAGE_KEY, handle) } catch {}
        return
      }
    } catch {
      // cookie parse error — ignore
    }
    try {
      const stored = localStorage.getItem(REFERRAL_STORAGE_KEY)
      if (stored && /^[A-Z0-9_-]{2,30}$/i.test(stored)) setReferralCode(stored)
    } catch {
      // ignore
    }
  }, [searchParams])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(referralCode ? { referred_by_code: referralCode } : {}),
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    try {
      localStorage.removeItem(REFERRAL_STORAGE_KEY)
    } catch {
      // ignore
    }

    // If email confirmation is disabled in Supabase, redirect immediately
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <Card className="bg-card/80 border-border backdrop-blur-sm shadow-xl shadow-black/5">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-bold text-foreground">Account created!</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Check your email to confirm your account, then sign in to get started.
            </p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="mt-2 gap-2">
              Go to sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/80 border-border backdrop-blur-sm shadow-xl shadow-black/5">
      <CardHeader className="space-y-1 pb-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit mb-2">
          <span className="text-xs font-medium text-emerald-400">3 free clips per month</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Create your studio</h2>
        <p className="text-sm text-muted-foreground">No card · No installation · Cancel anytime</p>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          {referralCode && (
            <div className="text-xs bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 py-2.5 flex items-center gap-2">
              <Gift className="h-3.5 w-3.5 shrink-0" />
              <span>
                Referred by <span className="font-bold font-mono">{referralCode}</span> — welcome&nbsp;!
              </span>
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
                className="pl-10 h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="pl-10 h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="8 characters minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                className="pl-10 h-11"
              />
            </div>
          </div>

          {/* Password strength hint */}
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  password.length >= i * 3
                    ? password.length >= 12
                      ? 'bg-green-500'
                      : password.length >= 8
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/20"
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
            ) : (
              <>Create my free account <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
