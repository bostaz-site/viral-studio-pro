/**
 * Shared helpers for API routes.
 * Reduces copy-paste of auth checks, error formatting, and common patterns.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

// ── Standardized API response ────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  message: string
}

export function apiSuccess<T>(data: T, message: string, status = 200) {
  return NextResponse.json({ data, error: null, message }, { status })
}

export function apiError(error: string, message: string, status: number) {
  return NextResponse.json({ data: null, error, message }, { status })
}

// ── Auth helper ──────────────────────────────────────────────────────────────

export interface AuthResult {
  user: User
}

/**
 * Authenticate the current request. Returns the user or an error response.
 *
 * Usage:
 * ```ts
 * const auth = await requireAuth()
 * if ('response' in auth) return auth.response
 * const { user } = auth
 * ```
 */
export async function requireAuth(): Promise<AuthResult | { response: NextResponse }> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: apiError('Unauthorized', 'Authentication required', 401),
    }
  }

  return { user }
}

// ── Safe JSON body parser ────────────────────────────────────────────────────

export async function parseJsonBody<T>(
  request: Request,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { message: string } } }
): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: apiError('Invalid JSON', 'Corps de requête invalide', 400) }
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return { response: apiError(parsed.error?.message ?? 'Validation failed', 'Paramètres invalides', 400) }
  }

  return { data: parsed.data as T }
}

// ── Error handler ────────────────────────────────────────────────────────────

export function handleApiError(error: unknown, fallbackMessage = 'Internal server error') {
  const message = error instanceof Error ? error.message : fallbackMessage
  // Don't leak internal error details in production
  const safeMessage = process.env.NODE_ENV === 'production' ? fallbackMessage : message
  return apiError(safeMessage, safeMessage, 500)
}
