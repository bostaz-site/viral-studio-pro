import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase auth callback — exchanges PKCE code for session.
 * Used by: password recovery, email confirmation, magic links.
 *
 * Flow: Supabase email link → Supabase auth server verifies token →
 * redirects here with ?code=AUTH_CODE → exchange → redirect to ?next= path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const origin = request.nextUrl.origin

  if (!code) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', 'Missing auth code. Please request a new link.')
    return NextResponse.redirect(loginUrl)
  }

  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] Code exchange failed:', error.message)
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', 'Reset link expired or invalid. Please request a new one.')
    return NextResponse.redirect(loginUrl)
  }

  // Validate next is a safe relative path (prevent open redirect)
  const safePath = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(new URL(safePath, origin))
}
