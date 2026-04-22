'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ backgroundColor: '#0a0a1a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', padding: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '28rem' }}>
              {error.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={reset}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: 'transparent', color: '#e2e8f0', border: '1px solid #334155', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
