import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin-emails'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ isAdmin: false })
    }

    return NextResponse.json({ isAdmin: isAdminEmail(user.email) })
  } catch {
    return NextResponse.json({ isAdmin: false })
  }
}
