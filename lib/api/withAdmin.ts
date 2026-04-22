import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { withAuth, errorResponse } from './withAuth'
import { isAdminEmail } from '@/lib/auth/admin-emails'

// Re-export isAdminEmail for backward compatibility with existing server imports
export { isAdminEmail }

type AdminHandler = (req: NextRequest, user: User) => Promise<NextResponse>

export function withAdmin(handler: AdminHandler) {
  return withAuth(async (req, user) => {
    if (!isAdminEmail(user.email)) {
      return errorResponse('Forbidden', 403)
    }
    return handler(req, user)
  })
}
