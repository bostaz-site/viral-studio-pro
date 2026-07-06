'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface OnboardingStatus {
  stripe_connect_status: string | null
  stripe_connect_charges_enabled: boolean
  stripe_connect_payouts_enabled: boolean
  stripe_connect_onboarded_at: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string; description: string }> = {
  not_created: {
    label: 'Not Started',
    color: 'text-zinc-400',
    description: 'Your payment setup has not been started yet. Contact us if you need help.',
  },
  pending_kyc: {
    label: 'Verification Pending',
    color: 'text-amber-400',
    description: 'Please complete your identity verification with Stripe to start receiving payouts.',
  },
  active: {
    label: 'Verified',
    color: 'text-green-400',
    description: 'Your account is fully verified. You will receive payouts on the 1st of each month.',
  },
  restricted: {
    label: 'Action Required',
    color: 'text-orange-400',
    description: 'Stripe needs additional information. Click below to update your details.',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    description: 'Your verification was not approved. Please contact us for assistance.',
  },
}

export default function PartnerOnboardingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><WolfLoader variant="spinner" size={32} mode="amber" /></div>}>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const success = searchParams.get('success')
  const refresh = searchParams.get('refresh')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/partner/stats', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/partner/login')
          return
        }
        const json = await res.json()
        if (json.data?.onboarding) {
          setStatus(json.data.onboarding)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, refreshing])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <WolfLoader variant="spinner" size={32} mode="amber" />
      </div>
    )
  }

  const connectStatus = status?.stripe_connect_status || 'not_created'
  const info = STATUS_MAP[connectStatus] || STATUS_MAP.not_created
  const isVerified = connectStatus === 'active' && status?.stripe_connect_charges_enabled && status?.stripe_connect_payouts_enabled

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Payment Setup</h1>

      {/* Success message after Stripe redirect */}
      {success === 'true' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-400">
            Thanks! Your information has been submitted to Stripe. Verification usually takes a few minutes.
          </p>
        </div>
      )}

      {refresh === 'true' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-400">
            Your session expired. Please click below to continue verification.
          </p>
        </div>
      )}

      {/* Status card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Verification Status</span>
          <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
        </div>

        {isVerified ? (
          <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-4">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
            <div>
              <p className="text-sm text-green-400 font-medium">All set!</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Verified on {status?.stripe_connect_onboarded_at
                  ? new Date(status.stripe_connect_onboarded_at).toLocaleDateString()
                  : '--'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-400">{info.description}</p>
            {(connectStatus === 'pending_kyc' || connectStatus === 'restricted') && (
              <p className="text-xs text-zinc-500">
                Check your email for the Stripe verification link, or contact us to get a new one.
              </p>
            )}
          </>
        )}

        <button
          onClick={() => { setRefreshing(r => !r) }}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh status
        </button>
      </div>

      {/* Back to dashboard */}
      <a
        href="/partner"
        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Back to dashboard
      </a>
    </div>
  )
}
