import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifySignup } from '@/lib/discord/notify'

/**
 * POST /api/events/signup
 *
 * Called from the signup page after successful auth.signUp().
 * Sends a Discord notification to the activity channel.
 * Fire-and-forget — client doesn't wait for the result.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { source?: string }

    // Verify the user just signed up (has a valid session)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ ok: true }) // silently ignore unauthenticated calls
    }

    void notifySignup({
      email: user.email,
      plan: 'free',
      source: body.source ?? null,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // never fail user-facing
  }
}
