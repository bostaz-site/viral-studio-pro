import { cn } from '@/lib/utils'

interface WolfLoaderProps {
  size?: number
  className?: string
}

export function WolfLoader({ size = 48, className }: WolfLoaderProps) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const headSize = size * 0.22

  return (
    <div className={cn('inline-flex items-center justify-center', className)}>
      <style jsx>{`
        @keyframes wolfSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wolfDash {
          0% { stroke-dashoffset: ${circumference * 0.75}; }
          50% { stroke-dashoffset: ${circumference * 0.25}; }
          100% { stroke-dashoffset: ${circumference * 0.75}; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wolf-spinner { animation: none !important; }
          .wolf-body { animation: none !important; }
          .wolf-pulse { animation: wolfPulse 2s ease-in-out infinite !important; }
        }
        @keyframes wolfPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="wolf-pulse"
      >
        {/* Track circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#7C2D12"
          strokeWidth={size * 0.05}
          opacity={0.3}
        />

        {/* Animated body arc */}
        <g
          className="wolf-spinner"
          style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'wolfSpin 1.8s linear infinite' }}
        >
          <circle
            className="wolf-body"
            cx={cx}
            cy={cy}
            r={r}
            stroke="#F97316"
            strokeWidth={size * 0.06}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.4}
            style={{ animation: 'wolfDash 1.4s ease-in-out infinite' }}
          />

          {/* Wolf head at the leading edge (top of circle) */}
          <g transform={`translate(${cx - headSize / 2}, ${cy - r - headSize * 0.55})`}>
            {/* Left ear */}
            <polygon
              points={`${headSize * 0.15},${headSize * 0.35} ${headSize * 0.3},0 ${headSize * 0.38},${headSize * 0.4}`}
              fill="#F97316"
            />
            {/* Right ear */}
            <polygon
              points={`${headSize * 0.85},${headSize * 0.35} ${headSize * 0.7},0 ${headSize * 0.62},${headSize * 0.4}`}
              fill="#F97316"
            />
            {/* Head shape */}
            <polygon
              points={`${headSize * 0.2},${headSize * 0.3} ${headSize * 0.5},${headSize * 0.2} ${headSize * 0.8},${headSize * 0.3} ${headSize * 0.75},${headSize * 0.7} ${headSize * 0.5},${headSize * 0.85} ${headSize * 0.25},${headSize * 0.7}`}
              fill="#F97316"
            />
            {/* Eyes */}
            <polygon
              points={`${headSize * 0.32},${headSize * 0.42} ${headSize * 0.42},${headSize * 0.38} ${headSize * 0.38},${headSize * 0.52}`}
              fill="#7C2D12"
            />
            <polygon
              points={`${headSize * 0.68},${headSize * 0.42} ${headSize * 0.58},${headSize * 0.38} ${headSize * 0.62},${headSize * 0.52}`}
              fill="#7C2D12"
            />
            {/* Nose */}
            <polygon
              points={`${headSize * 0.44},${headSize * 0.6} ${headSize * 0.56},${headSize * 0.6} ${headSize * 0.5},${headSize * 0.7}`}
              fill="#7C2D12"
            />
          </g>
        </g>
      </svg>
    </div>
  )
}

export function WolfLoaderInline({ className }: { className?: string }) {
  return <WolfLoader size={20} className={className} />
}
