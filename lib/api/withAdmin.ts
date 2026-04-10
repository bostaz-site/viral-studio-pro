import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { withAuth, errorResponse } from './withAuth'

// Admin allowlist. Comma-separated in env so we can add more emails later
// without a redeploy. Falls back to Samy's personal address so the first
// admin page works on day one.
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? 'samycloutier30@gmail.com'
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

type AdminHandler = (req: NextRequest, user: User) => Promise<NextResponse>

export function withAdmin(handler: AdminHandler) {
  return withAuth(async (req, user) => {
    const email = user.email?.toLowerCase()
    if (!email || !getAdminEmails().has(email)) {
      return errorResponse('Forbidden', 403)
    }
    return handler(req, user)
  })
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().has(email.toLowerCase())
}
