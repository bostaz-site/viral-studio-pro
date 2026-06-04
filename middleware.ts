import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/dashboard', '/settings']
const AUTH_ROUTES = ['/login', '/signup']

const isAuditMode = process.env.NEXT_PUBLIC_AUDIT_MODE === 'true'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Audit Mode: block browse & admin routes (admins bypass) ──
  if (isAuditMode) {
    // Check if user is admin (bypass audit mode)
    let isAdmin = false
    if (user) {
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
        .maybeSingle()
      isAdmin = !!data
    }

    if (!isAdmin) {
      // /dashboard exact → redirect to /upload (Browse Clips page)
      if (pathname === '/dashboard') {
        return NextResponse.redirect(new URL('/upload', request.url))
      }
      // /admin/* → 404
      if (pathname.startsWith('/admin')) {
        return NextResponse.rewrite(new URL('/not-found', request.url))
      }
    }
  }

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  // Redirect unauthenticated users trying to access protected routes
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && user) {
    const dest = isAuditMode ? '/upload' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
