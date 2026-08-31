import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/me/platform-access
 *
 * Returns which preview-gated platforms the current user can access.
 * No email is ever exposed to the client — only the platform list.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ previewPlatforms: [] })
  }

  const raw = process.env.META_PREVIEW_EMAILS ?? ''
  if (!raw || !user.email) {
    return NextResponse.json({ previewPlatforms: [] })
  }

  const allowed = new Set(raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean))

  if (allowed.has(user.email.toLowerCase())) {
    return NextResponse.json({ previewPlatforms: ['instagram', 'facebook'] })
  }

  return NextResponse.json({ previewPlatforms: [] })
}
