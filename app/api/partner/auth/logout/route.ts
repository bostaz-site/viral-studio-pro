import { NextResponse } from 'next/server'
import { clearPartnerCookie } from '@/lib/partner/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viralanimal.com'

// POST /api/partner/auth/logout
export async function POST() {
  await clearPartnerCookie()
  return NextResponse.json({ ok: true })
}

// GET for simple redirect
export async function GET() {
  await clearPartnerCookie()
  return NextResponse.redirect(new URL('/partner/login', APP_URL))
}
