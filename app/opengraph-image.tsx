import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Viral Animal — Go viral with split-screen clips from your streams'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Glow effects */}
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '20%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            filter: 'blur(80px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '20%',
            width: 250,
            height: 250,
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            filter: 'blur(80px)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '0 80px',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 40,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              V
            </div>
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(90deg, #60a5fa, #818cf8)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              VIRAL ANIMAL
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: 'white',
              textAlign: 'center',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              margin: 0,
              maxWidth: 900,
            }}
          >
            Viral clips in{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              split-screen
            </span>{' '}
            from your streams
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 22,
              color: 'rgba(148, 163, 184, 0.9)',
              textAlign: 'center',
              marginTop: 20,
              maxWidth: 700,
              lineHeight: 1.5,
            }}
          >
            Karaoke captions + B-roll + AI viral score
          </p>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              marginTop: 40,
              padding: '16px 32px',
              borderRadius: 16,
              border: '1px solid rgba(99, 102, 241, 0.2)',
              background: 'rgba(99, 102, 241, 0.05)',
            }}
          >
            {[
              { value: '12,847', label: 'clips created' },
              { value: '2,340+', label: 'creators' },
              { value: 'x8.5', label: 'avg views' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>{stat.value}</span>
                <span style={{ fontSize: 13, color: 'rgba(148, 163, 184, 0.6)' }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
