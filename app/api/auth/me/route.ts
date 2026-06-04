import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin-emails'
import { isAdminUser } from '@/lib/admin/is-admin'
import { isAuditMode } from '@/lib/feature-flags'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ isAdmin: false, effectiveAuditMode: isAuditMode })
    }

    const admin = isAdminEmail(user.email) || await isAdminUser(supabase, user.id)

    return NextResponse.json({
      isAdmin: admin,
      effectiveAuditMode: isAuditMode && !admin,
    })
  } catch {
    return NextResponse.json({ isAdmin: false, effectiveAuditMode: isAuditMode })
  }
}
