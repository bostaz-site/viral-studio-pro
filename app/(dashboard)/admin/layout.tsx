import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/is-admin'

/**
 * Server-side admin guard. All /admin/* pages are wrapped by this layout.
 * Non-admin users are redirected to / (never see admin UI).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await isAdminUser(supabase, user.id)
  if (!admin) {
    redirect('/')
  }

  return <>{children}</>
}
