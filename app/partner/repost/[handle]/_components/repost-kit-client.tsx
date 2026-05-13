'use client'

import { useEffect, useState } from 'react'
import { initTracker, trackEvent, destroyTracker } from '@/lib/partner/repost-kit/tracker'
import { VideoPlayerTracked } from './video-player-tracked'
import { CodeCopyCard } from './code-copy-card'
import { CaptionCard } from './caption-card'
import { ProgressTracker } from './progress-tracker'
import { ProjectedCommission } from './projected-commission'
import { MobileActions } from './mobile-actions'
import { SubmitPostForm } from './submit-post-form'
import { SocialProof } from './social-proof'
import { CustomizeButton } from './customize-button'
import { HelpCircle } from 'lucide-react'

interface KitData {
  sessionId: string
  influencer: {
    firstName: string
    handle: string
    promoCode: string
    audienceSize: number | null
    niche: string | null
  }
  video: {
    url: string | null
  }
  caption: string
  hashtags: string
  commission: {
    views: number
    signups: number
    monthlyLow: number
    monthlyHigh: number
  }
  socialProof: {
    repostCount: number
    topEarner: number
  }
}

export function RepostKitClient({ data }: { data: KitData }) {
  const [downloaded, setDownloaded] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    initTracker(data.sessionId)
    trackEvent('kit_viewed')
    return () => destroyTracker()
  }, [data.sessionId])

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      {/* 1. Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-zinc-100">
          Hi {data.influencer.firstName}
        </h1>
        <p className="text-sm text-amber-400 font-medium">
          Your repost kit is ready
        </p>
      </div>

      {/* 2. Progress bar */}
      <ProgressTracker
        downloaded={downloaded}
        captionCopied={captionCopied}
        submitted={submitted}
      />

      {/* 3. Video player + download */}
      <VideoPlayerTracked
        videoUrl={data.video.url}
        onDownloaded={() => setDownloaded(true)}
      />

      {/* 4. Promo code */}
      <CodeCopyCard
        code={data.influencer.promoCode}
        onCopied={() => {}}
      />

      {/* 5. Caption + hashtags */}
      <CaptionCard
        caption={data.caption}
        hashtags={data.hashtags}
        handle={data.influencer.handle}
        onCaptionCopied={() => setCaptionCopied(true)}
      />

      {/* 6. Projected commission */}
      <ProjectedCommission
        views={data.commission.views}
        signups={data.commission.signups}
        monthlyLow={data.commission.monthlyLow}
        monthlyHigh={data.commission.monthlyHigh}
      />

      {/* 7. Social proof */}
      <SocialProof
        repostCount={data.socialProof.repostCount}
        topEarner={data.socialProof.topEarner}
      />

      {/* 8. Mobile actions */}
      <MobileActions />

      {/* 9. Submit post URL */}
      <SubmitPostForm
        sessionId={data.sessionId}
        onSubmitted={() => setSubmitted(true)}
      />

      {/* 10. Customize */}
      <CustomizeButton />

      {/* 11. Help */}
      <button
        onClick={() => {
          trackEvent('help_clicked')
          setShowHelp(!showHelp)
        }}
        className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Need help reposting?
      </button>

      {showHelp && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-xs text-zinc-400 space-y-2">
          <p><strong className="text-zinc-300">1.</strong> Download the video using the buttons above</p>
          <p><strong className="text-zinc-300">2.</strong> Copy the caption (includes required #ad disclosure)</p>
          <p><strong className="text-zinc-300">3.</strong> Open TikTok/Instagram/YouTube and upload the video</p>
          <p><strong className="text-zinc-300">4.</strong> Paste the caption and post</p>
          <p><strong className="text-zinc-300">5.</strong> Come back here and submit the link to your post</p>
          <p className="text-amber-400/80 pt-2">You earn 30% commission on every signup — recurring monthly!</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-zinc-600 pt-4 border-t border-zinc-800 space-y-1">
        <p>Viral Animal Partner Program</p>
        <p>30% recurring commission on every referred signup</p>
      </div>
    </div>
  )
}
