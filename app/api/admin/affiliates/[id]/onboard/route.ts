import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { createConnectAccount, createOnboardingLink, sendOnboardingEmail } from '@/lib/admin/stripe/connect-onboarding'
import { assignAffiliateCodeOnOnboarded } from '@/lib/admin/affiliate-code'

// POST /api/admin/affiliates/[id]/onboard
// Creates Stripe Connect Express account + sends onboarding email
export const POST = withAdmin(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) {
    return NextResponse.json({ data: null, error: 'Missing influencer ID' }, { status: 400 })
  }

  try {
    // 1. Auto-assign affiliate code if needed
    await assignAffiliateCodeOnOnboarded(id)

    // 2. Create Stripe Connect Express account
    const accountId = await createConnectAccount(id)
    if (!accountId) {
      return NextResponse.json({ data: null, error: 'Failed to create Connect account' }, { status: 500 })
    }

    // 3. Generate onboarding link
    const onboardingUrl = await createOnboardingLink(id)

    // 4. Send onboarding email
    await sendOnboardingEmail(id, onboardingUrl)

    return NextResponse.json({
      data: {
        stripe_connect_account_id: accountId,
        onboarding_url: onboardingUrl,
      },
      error: null,
      message: 'Connect account created and onboarding email sent',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
})
