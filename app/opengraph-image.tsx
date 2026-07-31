import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Viral Animal — The radar finds clips blowing up. You post them in three clicks.'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Master wolf path (source: SYSTEM-REFERENCE-BRAND-LOGO.md)
const WOLF_PATH = 'M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z M 51.0 137.0 L 56.0 163.0 L 64.0 173.0 L 64.0 172.0 L 66.0 171.0 L 72.0 177.0 L 74.0 178.0 L 76.0 177.0 L 81.0 172.0 L 83.0 173.0 L 89.0 167.0 L 92.0 162.0 L 92.0 159.0 L 93.0 158.0 L 93.0 153.0 L 94.0 152.0 L 94.0 148.0 L 95.0 147.0 L 96.0 138.0 L 94.0 142.0 L 94.0 145.0 L 91.0 150.0 L 90.0 155.0 L 87.0 160.0 L 85.0 159.0 L 83.0 153.0 L 82.0 157.0 L 81.0 158.0 L 81.0 161.0 L 79.0 164.0 L 68.0 164.0 L 67.0 163.0 L 67.0 159.0 L 66.0 158.0 L 65.0 153.0 L 62.0 160.0 L 61.0 160.0 L 59.0 158.0 L 58.0 154.0 L 56.0 151.0 L 55.0 146.0 L 53.0 143.0 L 52.0 138.0 Z M 110.0 82.0 L 110.0 83.0 L 109.0 84.0 L 109.0 86.0 L 108.0 87.0 L 108.0 89.0 L 107.0 90.0 L 107.0 91.0 L 106.0 92.0 L 105.0 95.0 L 103.0 97.0 L 101.0 97.0 L 100.0 98.0 L 95.0 98.0 L 94.0 99.0 L 91.0 100.0 L 91.0 101.0 L 90.0 102.0 L 89.0 102.0 L 87.0 104.0 L 86.0 104.0 L 85.0 103.0 L 85.0 101.0 L 86.0 100.0 L 86.0 96.0 L 89.0 93.0 L 90.0 93.0 L 92.0 91.0 L 93.0 91.0 L 95.0 89.0 L 96.0 89.0 L 98.0 87.0 L 99.0 87.0 L 104.0 83.0 L 105.0 83.0 L 108.0 81.0 L 109.0 81.0 Z M 38.0 82.0 L 39.0 81.0 L 42.0 82.0 L 44.0 84.0 L 45.0 84.0 L 47.0 86.0 L 48.0 86.0 L 50.0 88.0 L 51.0 88.0 L 53.0 90.0 L 54.0 90.0 L 56.0 92.0 L 57.0 92.0 L 59.0 94.0 L 60.0 94.0 L 61.0 95.0 L 61.0 98.0 L 62.0 99.0 L 62.0 103.0 L 61.0 104.0 L 60.0 104.0 L 55.0 99.0 L 52.0 99.0 L 51.0 98.0 L 47.0 98.0 L 46.0 97.0 L 45.0 97.0 L 42.0 94.0 L 42.0 93.0 L 40.0 90.0 L 40.0 88.0 L 38.0 85.0 Z M 28.0 116.0 L 31.0 117.0 L 33.0 119.0 L 34.0 119.0 L 36.0 121.0 L 37.0 121.0 L 37.0 119.0 L 36.0 118.0 L 36.0 116.0 L 34.0 113.0 L 32.0 113.0 L 30.0 115.0 L 29.0 115.0 Z M 119.0 116.0 L 118.0 115.0 L 117.0 115.0 L 115.0 113.0 L 113.0 113.0 L 113.0 114.0 L 112.0 115.0 L 112.0 117.0 L 111.0 118.0 L 111.0 120.0 L 110.0 121.0 L 113.0 120.0 L 115.0 118.0 L 116.0 118.0 L 118.0 116.0 Z M 103.0 88.0 L 100.0 89.0 L 98.0 91.0 L 97.0 91.0 L 95.0 93.0 L 94.0 93.0 L 93.0 94.0 L 99.0 94.0 L 100.0 93.0 L 101.0 93.0 L 102.0 92.0 L 102.0 90.0 L 103.0 89.0 Z M 45.0 88.0 L 45.0 90.0 L 46.0 91.0 L 46.0 92.0 L 48.0 94.0 L 54.0 94.0 L 52.0 92.0 L 51.0 92.0 L 49.0 90.0 L 48.0 90.0 Z'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(180deg, #0F172A, #020617)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle cyan grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Wolf — Predator variant (goldForge + rim cyan) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 60, padding: '0 80px' }}>
          <svg
            width={320}
            height={393}
            viewBox="0 0 149 183"
            style={{ flexShrink: 0 }}
          >
            <defs>
              <linearGradient id="og-goldForge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FEF3C7" />
                <stop offset="18%" stopColor="#FDE68A" />
                <stop offset="42%" stopColor="#FBBF24" />
                <stop offset="62%" stopColor="#D97706" />
                <stop offset="84%" stopColor="#92400E" />
                <stop offset="100%" stopColor="#78350F" />
              </linearGradient>
              <linearGradient id="og-rimCyan" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#67E8F9" stopOpacity=".9" />
                <stop offset="35%" stopColor="#38BDF8" stopOpacity=".25" />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="og-rimMaskGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="45%" stopColor="black" />
                <stop offset="72%" stopColor="white" />
                <stop offset="100%" stopColor="white" />
              </linearGradient>
              <mask id="og-rimMask">
                <rect width="149" height="183" fill="url(#og-rimMaskGrad)" />
              </mask>
            </defs>
            <path fill="url(#og-goldForge)" fillRule="evenodd" d={WOLF_PATH} />
            <path
              fill="none"
              stroke="url(#og-rimCyan)"
              strokeWidth="3"
              mask="url(#og-rimMask)"
              fillRule="evenodd"
              d={WOLF_PATH}
            />
          </svg>

          {/* Wordmark + tagline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '0.06em', color: '#FFFFFF' }}>
                VIRAL
              </span>
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '0.06em', color: '#F59E0B' }}>
                ANIMAL
              </span>
            </div>
            <p style={{ fontSize: 24, color: '#CBD5E1', margin: 0, letterSpacing: '0.01em' }}>
              Turn streams into viral clips. Automatically.
            </p>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
