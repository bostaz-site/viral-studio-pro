'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Image, FileText, MessageSquare, Tv } from 'lucide-react'
import Link from 'next/link'

interface PromoSection {
  title: string
  description: string
  icon: React.ElementType
  items: { name: string; description: string }[]
}

const SECTIONS: PromoSection[] = [
  {
    title: 'Brand Assets',
    description: 'Logos, colors, and brand identity for your content',
    icon: Image,
    items: [
      { name: 'Logo (PNG, dark bg)', description: 'Transparent PNG for overlays' },
      { name: 'Logo (SVG)', description: 'Vector format for any size' },
      { name: 'Brand Colors', description: 'Amber #F59E0B, Zinc #18181B' },
      { name: 'Banner (1200x630)', description: 'For link previews and social headers' },
    ],
  },
  {
    title: 'Social Media Templates',
    description: 'Ready-to-post captions and tweet templates',
    icon: MessageSquare,
    items: [
      { name: 'Tweet/X template', description: '"Just found @ViralAnimal — turns my streams into viral clips automatically. Use my link for..."' },
      { name: 'TikTok/IG caption', description: '"This tool changed my clipping game. Link in bio..."' },
      { name: 'YouTube description', description: 'Paragraph + link for video descriptions' },
      { name: 'Discord announcement', description: 'Ready to paste in your server' },
    ],
  },
  {
    title: 'Email Templates',
    description: 'For DMs and email outreach to creator friends',
    icon: FileText,
    items: [
      { name: 'Short DM', description: '2-3 sentences, casual tone' },
      { name: 'Email pitch', description: 'Detailed value prop for serious creators' },
      { name: 'Follow-up', description: 'Gentle nudge after initial pitch' },
    ],
  },
  {
    title: 'Stream Assets',
    description: 'Overlays and panels for Twitch/Kick streams',
    icon: Tv,
    items: [
      { name: 'Twitch panel (320x160)', description: '"Powered by Viral Animal" panel' },
      { name: 'Stream overlay', description: 'Transparent overlay with your ref link' },
      { name: 'Chat command', description: '!viralanimal → your affiliate link' },
    ],
  },
]

export default function PromoKitPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // Quick auth check
    fetch('/api/partner/stats', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) router.push('/partner/login')
        else setAuthed(true)
      })
      .catch(() => router.push('/partner/login'))
  }, [router])

  if (!authed) return null

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/partner"
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Promo Kit</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Everything you need to promote Viral Animal and earn 30% recurring commissions.
        </p>
      </div>

      {/* Best practices */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
        <h3 className="text-sm font-medium text-amber-400 mb-2">Best Practices</h3>
        <ul className="text-xs text-zinc-400 space-y-1">
          <li>- Put your link in your TikTok/IG bio — it gets the most clicks</li>
          <li>- Show a quick demo on stream — "watch this clip get remixed in 30 seconds"</li>
          <li>- Share real results — your viral clips vs the original</li>
          <li>- DM creator friends personally — higher conversion than public posts</li>
          <li>- Remind your audience periodically — most people need 3+ touches</li>
        </ul>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => (
        <div key={section.title} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-zinc-800">
              <section.icon className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-200">{section.title}</h3>
              <p className="text-xs text-zinc-500">{section.description}</p>
            </div>
          </div>

          <div className="space-y-2">
            {section.items.map(item => (
              <div key={item.name} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <div>
                  <p className="text-xs text-zinc-300">{item.name}</p>
                  <p className="text-[10px] text-zinc-500">{item.description}</p>
                </div>
                <button className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-center text-xs text-zinc-600">
        Need custom assets? Email partners@viralanimal.com
      </p>
    </div>
  )
}
