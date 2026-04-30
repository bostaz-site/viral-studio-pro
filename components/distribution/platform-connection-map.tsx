'use client'

import { cn } from '@/lib/utils'
import { ViralAnimalLogo } from '@/components/brand/viral-animal-logo'

interface PlatformNode {
  id: string
  label: string
  color: string
  x: number
  y: number
  comingSoon?: boolean
}

const NODES: PlatformNode[] = [
  { id: 'youtube',   label: 'YouTube',   color: '#EF4444', x: 55,  y: 20  },
  { id: 'tiktok',    label: 'TikTok',    color: '#E4E4E7', x: 245, y: 20  },
  { id: 'instagram', label: 'Instagram', color: '#D946EF', x: 55,  y: 170 },
  { id: 'facebook',  label: 'Facebook',  color: '#3B82F6', x: 245, y: 170, comingSoon: true },
]

const CENTER = { x: 150, y: 100 }

interface PlatformConnectionMapProps {
  connectedPlatforms: string[]
}

export function PlatformConnectionMap({ connectedPlatforms }: PlatformConnectionMapProps) {
  return (
    <div className="relative w-full max-w-[300px] h-[200px] mx-auto">
      {/* SVG lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200" fill="none">
        <defs>
          {NODES.map(node => (
            <linearGradient key={`grad-${node.id}`} id={`line-${node.id}`}
              x1={node.x} y1={node.y} x2={CENTER.x} y2={CENTER.y}
              gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={node.color} stopOpacity="0.6" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
            </linearGradient>
          ))}
        </defs>

        {NODES.map(node => {
          const connected = connectedPlatforms.includes(node.id)
          const comingSoon = node.comingSoon

          if (connected) {
            return (
              <g key={node.id}>
                {/* Glow under the line */}
                <line
                  x1={node.x} y1={node.y} x2={CENTER.x} y2={CENTER.y}
                  stroke={node.color} strokeWidth="4" strokeOpacity="0.08"
                  className="connection-glow"
                />
                {/* Animated data-flow line */}
                <line
                  x1={node.x} y1={node.y} x2={CENTER.x} y2={CENTER.y}
                  stroke={`url(#line-${node.id})`} strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="6 8"
                  className="connection-flow"
                />
              </g>
            )
          }

          return (
            <line
              key={node.id}
              x1={node.x} y1={node.y} x2={CENTER.x} y2={CENTER.y}
              stroke="#52525B" strokeWidth="1.5" strokeLinecap="round"
              strokeDasharray="4 6"
              strokeOpacity={comingSoon ? 0.15 : 0.3}
            />
          )
        })}
      </svg>

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
        .node-pulse {
          animation: nodePulse 2.5s ease-in-out infinite;
        }
        @keyframes dataFlow {
          0% { stroke-dashoffset: 28; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes lineGlow {
          0%, 100% { stroke-opacity: 0.05; }
          50% { stroke-opacity: 0.12; }
        }
        @keyframes centerPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.15); }
          50% { box-shadow: 0 0 20px rgba(249,115,22,0.35); }
        }
        @keyframes nodePulse {
          0%, 100% { box-shadow: 0 0 0px transparent; transform: scale(1); }
          50% { box-shadow: 0 0 10px var(--node-glow); transform: scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          .connection-flow,
          .connection-glow,
          .center-pulse,
          .node-pulse {
            animation: none;
          }
        }
      `}</style>

      {/* Center wolf logo */}
      <div
        className={cn(
          'absolute rounded-full bg-zinc-900/80 border-2 border-orange-500/30 flex items-center justify-center',
          connectedPlatforms.length > 0 && 'center-pulse'
        )}
        style={{ left: CENTER.x - 22, top: CENTER.y - 22, width: 44, height: 44 }}
      >
        <ViralAnimalLogo iconOnly size={28} />
      </div>

      {/* Platform nodes */}
      {NODES.map(node => {
        const connected = connectedPlatforms.includes(node.id)
        const comingSoon = node.comingSoon

        return (
          <div key={node.id} className="absolute flex flex-col items-center gap-1"
            style={{ left: node.x - 16, top: node.y - 16 }}>
            {/* Icon circle */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all',
                connected
                  ? 'node-pulse border-current'
                  : comingSoon
                    ? 'border-zinc-700/50 opacity-40'
                    : 'border-zinc-700 opacity-60'
              )}
              style={{
                backgroundColor: connected ? `${node.color}15` : 'rgba(39,39,42,0.6)',
                color: connected ? node.color : '#71717A',
                ['--node-glow' as string]: `${node.color}40`,
              }}
            >
              {node.id === 'youtube' && '\u25B6'}
              {node.id === 'tiktok' && '\u266A'}
              {node.id === 'instagram' && '\u25CE'}
              {node.id === 'facebook' && 'f'}
            </div>
            {/* Label */}
            <span className={cn(
              'text-[9px] font-medium',
              connected ? 'text-zinc-300' : 'text-zinc-600'
            )}>
              {node.label}
              {comingSoon && <span className="text-zinc-600 ml-0.5">*</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
