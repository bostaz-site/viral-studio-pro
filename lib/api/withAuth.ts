import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { ApiResponse } from '@/types/api'

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null, message: 'ok' } satisfies ApiResponse<T>, { status })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message, message } satisfies ApiResponse, { status })
}

// Auth middleware: extracts user or returns 401
type AuthHandler = (req: NextRequest, user: User) => Promise<NextResponse>

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest) => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return errorResponse('Authentication required', 401)
      }

      return await handler(req, user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      console.error(`[API ${req.method} ${req.nextUrl.pathname}]`, message)
      return errorResponse(message, 500)
    }
  }
}
