'use client'

import { cn } from '@/lib/utils'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'
import { Switch } from '@/components/ui/switch'
import { ExternalLink, Check, AlertCircle, Clock } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface PlatformNode {
  id: string
  label: string
  icon: string
  color: string
  gradient: string
  /** Position as percentage of container */
  px: number
  py: number
  comingSoon?: boolean
}

const NODES: PlatformNode[] = [
  { id: 'tiktok',    label: 'TikTok',          icon: '♪', color: '#E4E4E7', gradient: 'from-zinc-900 to-zinc-700',     px: 12,  py: 8   },
  { id: 'youtube',   label: 'YouTube Shorts',  icon: '▶', color: '#EF4444', gradient: 'from-red-600 to-red-500',       px: 72,  py: 8   },
  { id: 'instagram', label: 'Instagram Reels', icon: '◎', color: '#D946EF', gradient: 'from-pink-600 to-purple-600',   px: 12,  py: 68  },
  { id: 'facebook',  label: 'Facebook Reels',  icon: 'f', color: '#3B82F6', gradient: 'from-blue-600 to-blue-500',     px: 72,  py: 68, comingSoon: true },
]

/* Center of container in percent */
const CX = 42
const CY = 42

interface PlatformConnectionMapProps {
  connectedPlatforms: string[]
  publishTargets: Array<{ platform: string; enabled: boolean }>
  togglePublishTarget: (platform: string) => void
  onConnect: () => void
  aiAutoDistribute?: boolean
  publishProgress?: Record<string, { status: string }>
}

export function PlatformConnectionMap({
  connectedPlatforms,
  publishTargets,
  togglePublishTarget,
  onConnect,
  aiAutoDistribute = false,
  publishProgress = {},
}: PlatformConnectionMapProps) {
  return (
    <div className="relative w-full max-w-[580px] mx-auto" style={{ height: 360 }}>
      {/* CSS animations */}
      <style jsx>{`
        .connection-flow {
          animation: dataFlow 3.5s linear infinite;
        }
        .connection-glow {
          animation: lineGlow 3s ease-in-out infinite;
        }
        .center-pulse {
          animation: centerPulse 3s ease-in-out infinite;
        }
        .node-glow {
          animation: nodeGlow 2.5s ease-in-out infinite;
        }
        @keyframes dataFlow {
          0% { stroke-dashoffset: 28; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes lineGlow {
          0%, 100% { stroke-opacity: 0.05; }
          50% { stroke-opacity: 0.15; }
        }
        @keyframes centerPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(249,115,22,0.2); }
          50% { box-shadow: 0 0 30px rgba(249,115,22,0.45); }
        }
        @keyframes nodeGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @media (prefers-reduced-motion: reduce) {
          .connection-flow, .connection-glow, .center-pulse, .node-glow { animation: none; }
        }
      `}</style>

      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 580 360" fill="none" preserveAspectRatio="xMidYMid meet">
        <defs>
          {NODES.map(node => {
            const nx = (node.px / 100) * 580 + 60
            const ny = (node.py / 100) * 360 + 20
            const cx = (CX / 100) * 580
            const cy = (CY / 100) * 360
            return (
              <linearGradient key={`grad-${node.id}`} id={`line-${node.id}`}
                x1={nx} y1={ny} x2={cx} y2={cy} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={node.color} stopOpacity="0.7" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
              </linearGradient>
            )
          })}
        </defs>

        {NODES.map(node => {
          const connected = connectedPlatforms.includes(node.id)
          const nx = (node.px / 100) * 580 + 60
          const ny = (node.py / 100) * 360 + 20
          const cx = (CX / 100) * 580
          const cy = (CY / 100) * 360

          if (connected) {
            return (
              <g key={node.id}>
                <line x1={nx} y1={ny} x2={cx} y2={cy}
                  stroke={node.color} strokeWidth="5" strokeOpacity="0.06"
                  className="connection-glow" />
                <line x1={nx} y1={ny} x2={cx} y2={cy}
                  stroke={`url(#line-${node.id})`} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray="6 8" className="connection-flow" />
              </g>
            )
          }

          return (
            <line key={node.id}
              x1={nx} y1={ny} x2={cx} y2={cy}
              stroke="#52525B" strokeWidth="1.5" strokeLinecap="round"
              strokeDasharray="4 6" strokeOpacity={node.comingSoon ? 0.12 : 0.25} />
          )
        })}
      </svg>

      {/* Center wolf logo — bigger */}
      <div
        className={cn(
          'absolute rounded-full bg-zinc-900/90 border-[3px] border-orange-500/40 flex items-center justify-center z-10',
          connectedPlatforms.length > 0 && 'center-pulse'
        )}
        style={{
          left: `${CX}%`, top: `${CY}%`,
          transform: 'translate(-50%, -50%)',
          width: 64, height: 64,
        }}
      >
        <ViralAnimalLogo iconOnly size={38} />
      </div>

      {/* Platform node cards */}
      {NODES.map(node => {
        const connected = connectedPlatforms.includes(node.id)
        const isActive = (publishTargets.find(t => t.platform === node.id)?.enabled ?? false) && connected
        const progress = publishProgress[node.id]
        const comingSoon = node.comingSoon

        return (
          <div key={node.id}
            className="absolute"
            style={{
              left: `${node.px}%`, top: `${node.py}%`,
              width: 140,
            }}
          >
            <div className={cn(
              'rounded-xl border p-3 transition-all duration-300 backdrop-blur-sm',
              isActive
                ? 'bg-card/80 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                : connected
                  ? 'bg-card/70 border-border'
                  : comingSoon
                    ? 'bg-card/30 border-border/40'
                    : 'bg-card/50 border-border/60'
            )}>
              {/* Active glow ring behind icon */}
              {isActive && (
                <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-purple-500/8 to-transparent pointer-events-none node-glow" />
              )}

              {/* Icon + label row */}
              <div className="flex items-center gap-2.5 relative">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-gradient-to-br flex-shrink-0',
                  node.gradient, 'text-white',
                  !connected && !comingSoon && 'opacity-40',
                  comingSoon && 'opacity-25 grayscale'
                )}>
                  {node.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-semibold truncate',
                    connected ? 'text-foreground' : comingSoon ? 'text-zinc-600' : 'text-zinc-400'
                  )}>
                    {node.label}
                  </p>

                  {/* Status line */}
                  {comingSoon ? (
                    <span className="text-[9px] text-zinc-600 font-medium">Coming soon</span>
                  ) : connected ? (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-emerald-400" />
                      <span className="text-[9px] text-emerald-400 font-medium">Connected</span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-zinc-500">Not connected</span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="mt-2.5 relative">
                {comingSoon ? (
                  <div className="h-7" /> /* spacer */
                ) : connected ? (
                  <div className="flex items-center justify-between">
                    <Switch
                      checked={publishTargets.find(t => t.platform === node.id)?.enabled ?? false}
                      onCheckedChange={() => togglePublishTarget(node.id)}
                    />
                    {/* Progress / AI timing indicator */}
                    {progress?.status === 'publishing' ? (
                      <span className="flex items-center gap-1 text-[9px] text-amber-400 font-medium">
                        <WolfLoader variant="spinner" size={10} mode="amber" /> Posting...
                      </span>
                    ) : progress?.status === 'published' ? (
                      <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-medium">
                        <Check className="h-2.5 w-2.5" /> Live
                      </span>
                    ) : progress?.status === 'error' ? (
                      <span className="flex items-center gap-1 text-[9px] text-red-400 font-medium">
                        <AlertCircle className="h-2.5 w-2.5" /> Failed
                      </span>
                    ) : isActive && aiAutoDistribute ? (
                      <span className="flex items-center gap-1 text-[9px] text-purple-400 font-medium">
                        <Clock className="h-2.5 w-2.5" /> AI timing
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <button
                    onClick={onConnect}
                    className="w-full text-[10px] font-semibold flex items-center justify-center gap-1 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/15 border border-orange-500/25 hover:border-orange-500/40 transition-all"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
