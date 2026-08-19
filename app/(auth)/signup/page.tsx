// TODO: Add rate limiting + CAPTCHA (spam/bot protection) — server-side middleware or Supabase rate limit
"use client"

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight, CheckCircle2, Gift } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

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
    <div className="rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl shadow-black/20 overflow-hidden">
      <div className="pt-8 pb-8 flex items-center justify-center">
        <WolfLoader variant="spinner" size={24} mode="amber" />
      </div>
    </div>
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
  const [acquisitionSource, setAcquisitionSource] = useState('')

  // Capture ref from URL param, cookie va_ref (set by /r/[code]), or localStorage
  useEffect(() => {
    const fromUrl = searchParams?.get('ref')?.trim()
    if (fromUrl && /^[a-z0-9_-]{2,30}$/i.test(fromUrl)) {
      setReferralCode(fromUrl)
      try {
        localStorage.setItem(REFERRAL_STORAGE_KEY, fromUrl)
      } catch {
        // localStorage disabled / private mode — carry on
      }
      return
    }
    // Check cookie set by /r/[code] (va_ref)
    try {
      const cookies = document.cookie.split(';').reduce<Record<string, string>>((acc, c) => {
        const [k, v] = c.trim().split('=')
        if (k && v) acc[k] = decodeURIComponent(v)
        return acc
      }, {})
      const cookieCode = cookies.va_ref || cookies.ref
      if (cookieCode && /^[a-z0-9_-]{2,30}$/i.test(cookieCode)) {
        setReferralCode(cookieCode)
        try { localStorage.setItem(REFERRAL_STORAGE_KEY, cookieCode) } catch {}
        return
      }
    } catch {
      // cookie parse error — ignore
    }
    try {
      const stored = localStorage.getItem(REFERRAL_STORAGE_KEY)
      if (stored && /^[a-z0-9_-]{2,30}$/i.test(stored)) setReferralCode(stored)
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
    track('signup_started', { hasReferral: !!referralCode })

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(referralCode ? { referred_by_code: referralCode } : {}),
          ...(acquisitionSource ? { acquisition_source: acquisitionSource } : {}),
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
    track('signup_completed', { hasReferral: !!referralCode })

    // Attribute signup to affiliate (best-effort, non-blocking)
    if (referralCode) {
      fetch('/api/affiliate/attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateCode: referralCode }),
      }).catch(() => {})
    }

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
      <div className="rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl shadow-black/20 overflow-hidden">
        <div className="pt-8 pb-8 text-center space-y-4 px-6">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-bold text-white">Account created!</p>
            <p className="text-sm text-white/50 max-w-xs mx-auto">
              Check your email to confirm your account, then sign in to get started.
            </p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="mt-2 gap-2 border-white/10 hover:bg-white/5">
              Go to sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl shadow-black/20 overflow-hidden">
      <div className="p-6 sm:p-8 space-y-1 pb-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 w-fit mb-2">
          <span className="text-xs font-medium text-amber-400">3 free clips per month</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Create your studio</h2>
        <p className="text-sm text-white/50">No card · No installation · Cancel anytime</p>
      </div>
      <form onSubmit={handleSignup}>
        <div className="px-6 sm:px-8 space-y-4">
          {referralCode && (
            <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Gift className="h-3.5 w-3.5 shrink-0" />
              <span>
                Referred by <span className="font-bold font-mono">{referralCode}</span> — welcome&nbsp;!
              </span>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium text-white/40 uppercase tracking-wider">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
                className="pl-10 h-11 text-base bg-black/30 border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
            </div>
          </div>
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
                placeholder="8 characters minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                className="pl-10 h-11 text-base bg-black/30 border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20"
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
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Acquisition source (optional, skippable) */}
          <div className="space-y-1.5">
            <Label htmlFor="acquisitionSource" className="text-xs font-medium text-white/40 uppercase tracking-wider">
              How did you hear about us? <span className="text-white/20 normal-case">(optional)</span>
            </Label>
            <Select value={acquisitionSource} onValueChange={setAcquisitionSource}>
              <SelectTrigger id="acquisitionSource" disabled={loading} className="h-11 bg-black/30 border-white/10">
                <span className="line-clamp-1">
                  {{ '': 'Skip', tiktok_watermark: 'TikTok watermark', friend_invited: 'A friend invited me', saw_ad: 'Saw an ad', creator_follow: 'A creator I follow', other: 'Other' }[acquisitionSource] ?? 'Skip'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Skip</SelectItem>
                <SelectItem value="tiktok_watermark">TikTok watermark</SelectItem>
                <SelectItem value="friend_invited">A friend invited me</SelectItem>
                <SelectItem value="saw_ad">Saw an ad</SelectItem>
                <SelectItem value="creator_follow">A creator I follow</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-6 sm:p-8 pt-6 flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 text-amber-950 font-semibold shadow-lg shadow-amber-500/20 rounded-xl"
            disabled={loading}
          >
            {loading ? (
              <><WolfLoader variant="spinner" size={16} mode="amber" /> Creating...</>
            ) : (
              <>Create my free account <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
          <p className="text-sm text-white/50 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}
