"use client"

import { ChevronDown } from 'lucide-react'

export const FAQ_ITEMS = [
  {
    q: 'How does the free plan work?',
    a: 'The Free plan gives you 3 free videos per month, reset on the 1st of the next month. No card required to sign up. Clips up to 60 seconds, Viral Studio watermark included. Upgrade to Pro for $19/month anytime to unlock 30 clips/month without watermark.',
  },
  {
    q: 'How is this different from OpusClip or Eklipse?',
    a: 'We&apos;re the only tool with auto split-screen (Subway Surfers, Minecraft on bottom). OpusClip and Eklipse don&apos;t offer it. We also have "Remake This" to learn from trending clips and AI viral scoring by Claude.',
  },
  {
    q: 'What exactly is split-screen? Does it actually work?',
    a: 'Your stream clip plays on top, with satisfying video (Subway Surfers, Minecraft parkour) on bottom. This format drives 3x TikTok retention because it creates dual visual stimulation. It&apos;s the formula top clip channels use.',
  },
  {
    q: 'Can I use my Twitch VODs or do I need to upload?',
    a: 'Both. Browse Twitch and YouTube Gaming clips directly in the app, or upload your own videos (MP4, MOV, WebM). Kick support coming soon.',
  },
  {
    q: 'Do I need to install software or is it browser-based?',
    a: 'Everything happens in your browser. Zero install, zero software. Create account, clip, export. That simple.',
  },
  {
    q: 'Where are my videos stored? Is it secure?',
    a: 'Your videos are stored on secure servers (Supabase / AWS). Only you have access. Delete anytime from your dashboard. We&apos;re GDPR compliant.',
  },
  {
    q: 'How long does it take to render a clip?',
    a: 'Usually 30-60 seconds depending on clip length and options (captions, split-screen, etc.). You get a preview as soon as it&apos;s done.',
  },
  {
    q: 'Can I cancel my subscription whenever?',
    a: 'Yes, 1 click from settings. No contract, no lock-in. You keep access until the end of your billing period.',
  },
  {
    q: 'Is the 7-day free trial actually free? Will I get charged secretly?',
    a: 'It&apos;s truly free. You provide a card to start, but nothing charges for 7 days. Cancel before day 7 ends and you&apos;re never charged. Stripe sends a reminder 3 days before expiry.',
  },
  {
    q: 'Do I own the clips I create?',
    a: '100%. Clips you create are fully yours. We don&apos;t reuse your videos, show them to anyone, or train AI on them. For clips from our streamer library, we auto-credit the original creator.',
  },
]

export function FaqSection() {
  return (
    <section className="py-20 px-6 bg-card/30 border-t border-border/30">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p className="text-muted-foreground mt-3 text-lg">Everything you need to know before you start</p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card/60 overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors list-none">
                {item.q}
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
