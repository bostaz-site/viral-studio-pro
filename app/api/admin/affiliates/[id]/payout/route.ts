import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { executePayout } from '@/lib/admin/stripe/payouts'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/affiliates/[id]/payout
// Approve or reject a pending_review payout for an affiliate
export const POST = withAdmin(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) {
    return NextResponse.json({ data: null, error: 'Missing influencer ID' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { action, payout_id } = body as { action: 'approve' | 'reject'; payout_id: string }

    if (!payout_id || !action) {
      return NextResponse.json({ data: null, error: 'payout_id and action required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify payout belongs to this influencer
    const { data: payout } = await admin
      .from('affiliate_payouts')
      .select('id, influencer_id, status')
      .eq('id', payout_id)
      .eq('influencer_id', id)
      .single()

    if (!payout) {
      return NextResponse.json({ data: null, error: 'Payout not found' }, { status: 404 })
    }

    if (action === 'reject') {
      await admin
        .from('affiliate_payouts')
        .update({ status: 'on_hold', failure_reason: 'Rejected by admin' })
        .eq('id', payout_id)

      return NextResponse.json({
        data: { status: 'on_hold' },
        error: null,
        message: 'Payout rejected and put on hold',
      })
    }

    if (action === 'approve') {
      if (payout.status !== 'pending_review') {
        return NextResponse.json(
          { data: null, error: `Cannot approve payout with status: ${payout.status}` },
          { status: 400 },
        )
      }

      // Mark as approved then execute
      await admin
        .from('affiliate_payouts')
        .update({ status: 'approved' })
        .eq('id', payout_id)

      await executePayout(payout_id)

      return NextResponse.json({
        data: { status: 'sending' },
        error: null,
        message: 'Payout approved and transfer initiated',
      })
    }

    return NextResponse.json({ data: null, error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
})
