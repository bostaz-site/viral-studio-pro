import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Non autorisé' },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('social_accounts')
    .select('id, platform, username, connected_at, platform_user_id')
    .eq('user_id', user.id)
    .order('connected_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Erreur de récupération' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data, error: null, message: 'OK' })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized', message: 'Non autorisé' },
      { status: 401 }
    )
  }

  const accountId = req.nextUrl.searchParams.get('id')
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!accountId || !UUID_RE.test(accountId)) {
    return NextResponse.json(
      { data: null, error: 'Missing or invalid id', message: 'ID UUID manquant ou invalide' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Verify ownership before deleting
  const { data: account } = await admin
    .from('social_accounts')
    .select('user_id')
    .eq('id', accountId)
    .single()

  if (!account || account.user_id !== user.id) {
    return NextResponse.json(
      { data: null, error: 'Not found', message: 'Compte introuvable' },
      { status: 404 }
    )
  }

  const { error } = await admin.from('social_accounts').delete().eq('id', accountId)
  if (error) {
    return NextResponse.json(
      { data: null, error: error.message, message: 'Erreur de suppression' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: { id: accountId }, error: null, message: 'Compte déconnecté' })
}
