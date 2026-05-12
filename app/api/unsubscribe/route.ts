import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken, markTokenUsed } from '@/lib/admin/unsubscribe-token'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — process unsubscribe (public, no auth required)
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Verify token
    const result = await verifyUnsubscribeToken(token)
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Add to suppression list
    await supabase.from('suppression_list').upsert(
      {
        email: result.email.toLowerCase(),
        email_domain: result.email.toLowerCase().split('@')[1],
        reason: 'unsubscribe',
        source: 'unsubscribe_link',
        metadata: {},
      },
      { onConflict: 'email', ignoreDuplicates: true },
    )

    // Mark influencer as unsubscribed if exists
    await supabase
      .from('influencers')
      .update({ status: 'blocked' })
      .ilike('email', result.email)

    // Mark token as used
    await markTokenUsed(result.tokenId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Unsubscribe]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
