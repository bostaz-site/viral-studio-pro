import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMagicLinkToken } from '@/lib/partner/magic-link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

// POST /api/partner/auth/request — send magic link email
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      // Always return success to prevent email enumeration
      return NextResponse.json({ ok: true })
    }

    const admin = createAdminClient()

    // Find influencer with eligible status
    const { data: influencer } = await admin
      .from('influencers')
      .select('id, email, first_name, display_name, status')
      .eq('email', email.toLowerCase().trim())
      .in('status', ['onboarded', 'active', 'paying'])
      .single()

    if (!influencer) {
      // Don't reveal if email exists — always return success
      return NextResponse.json({ ok: true })
    }

    // Generate magic link token
    const token = await generateMagicLinkToken(influencer.id)
    const magicLink = `${APP_URL}/partner/login/verify?t=${token}`
    const name = influencer.first_name || influencer.display_name || 'Partner'

    // Send email via Resend (or fallback to console)
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Viral Animal <partners@viralanimal.com>',
          to: [influencer.email],
          subject: 'Your partner dashboard login link',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f5f5f5;">Hi ${name},</h2>
              <p style="color: #a1a1aa;">Click the button below to access your Viral Animal partner dashboard:</p>
              <a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
                Open Dashboard
              </a>
              <p style="color: #71717a; font-size: 12px;">This link expires in 30 days. If you didn't request this, ignore this email.</p>
              <p style="color: #71717a; font-size: 12px;">— Viral Animal Team</p>
            </div>
          `,
        }),
      })
    } else {
      console.warn(`[partner/auth] Magic link for ${influencer.email}: ${magicLink}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[partner/auth/request]', err)
    return NextResponse.json({ ok: true }) // Never leak errors
  }
}
