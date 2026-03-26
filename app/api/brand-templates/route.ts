import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const createSchema = z.object({
  name: z.string().min(1).max(100),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  font_family: z.string().max(100).optional(),
  is_default: z.boolean().optional(),
})

// ── GET /api/brand-templates ──────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('brand_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ data: null, error: error.message, message: 'Erreur lors de la récupération' }, { status: 500 })
  }

  return NextResponse.json({ data, error: null, message: 'OK' })
}

// ── POST /api/brand-templates ─────────────────────────────────────────────────
// Multipart form: fields + optional file uploads (logo, watermark, intro, outro)

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid form data', message: 'Données invalides' }, { status: 400 })
  }

  const fields = {
    name: formData.get('name'),
    primary_color: formData.get('primary_color') ?? undefined,
    secondary_color: formData.get('secondary_color') ?? undefined,
    font_family: formData.get('font_family') ?? undefined,
    is_default: formData.get('is_default') === 'true',
  }

  const parsed = createSchema.safeParse(fields)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Paramètres invalides' }, { status: 400 })
  }

  // Upload asset files
  async function uploadAsset(file: File | null, assetType: string): Promise<string | null> {
    if (!file || file.size === 0) return null
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${user!.id}/${assetType}_${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await admin.storage.from('brand-assets').upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })
    if (error) throw new Error(`Asset upload failed (${assetType}): ${error.message}`)
    return path
  }

  try {
    const [logoPath, watermarkPath, introPath, outroPath] = await Promise.all([
      uploadAsset(formData.get('logo') as File | null, 'logo'),
      uploadAsset(formData.get('watermark') as File | null, 'watermark'),
      uploadAsset(formData.get('intro') as File | null, 'intro'),
      uploadAsset(formData.get('outro') as File | null, 'outro'),
    ])

    // If this template is set as default, unset all others first
    if (parsed.data.is_default) {
      await admin.from('brand_templates').update({ is_default: false }).eq('user_id', user.id)
    }

    const insertData = {
      user_id: user.id,
      name: parsed.data.name,
      primary_color: (parsed.data.primary_color as string | undefined) ?? null,
      secondary_color: (parsed.data.secondary_color as string | undefined) ?? null,
      font_family: (parsed.data.font_family as string | undefined) ?? null,
      is_default: parsed.data.is_default ?? false,
      logo_path: logoPath,
      watermark_path: watermarkPath,
      intro_video_path: introPath,
      outro_video_path: outroPath,
    }

    const { data, error: dbError } = await admin
      .from('brand_templates')
      .insert(insertData)
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({ data, error: null, message: 'Template créé avec succès' }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la création'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}

// ── DELETE /api/brand-templates?id= ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ data: null, error: 'Missing or invalid id', message: 'ID UUID manquant ou invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: template } = await admin
    .from('brand_templates')
    .select('user_id, logo_path, watermark_path, intro_video_path, outro_video_path')
    .eq('id', id)
    .single()

  if (!template || template.user_id !== user.id) {
    return NextResponse.json({ data: null, error: 'Not found', message: 'Template introuvable' }, { status: 404 })
  }

  // Delete storage assets
  const pathsToDelete = [
    template.logo_path,
    template.watermark_path,
    template.intro_video_path,
    template.outro_video_path,
  ].filter(Boolean) as string[]

  if (pathsToDelete.length > 0) {
    await admin.storage.from('brand-assets').remove(pathsToDelete)
  }

  const { error: dbError } = await admin.from('brand_templates').delete().eq('id', id)
  if (dbError) {
    return NextResponse.json({ data: null, error: dbError.message, message: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ data: { id }, error: null, message: 'Template supprimé' })
}

// ── PUT /api/brand-templates?id= ──────────────────────────────────────────────
// Same multipart form as POST, but updates an existing template

export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ data: null, error: 'Unauthorized', message: 'Non autorisé' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ data: null, error: 'Missing or invalid id', message: 'ID UUID manquant ou invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: existing } = await admin
    .from('brand_templates')
    .select('user_id, logo_path, watermark_path, intro_video_path, outro_video_path')
    .eq('id', id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ data: null, error: 'Not found', message: 'Template introuvable' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid form data', message: 'Données invalides' }, { status: 400 })
  }

  const fields = {
    name: formData.get('name'),
    primary_color: formData.get('primary_color') ?? undefined,
    secondary_color: formData.get('secondary_color') ?? undefined,
    font_family: formData.get('font_family') ?? undefined,
    is_default: formData.get('is_default') === 'true',
  }

  const parsed = createSchema.safeParse(fields)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message, message: 'Paramètres invalides' }, { status: 400 })
  }

  async function uploadAsset(file: File | null, assetType: string, existingPath: string | null): Promise<string | null> {
    if (!file || file.size === 0) return existingPath
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${user!.id}/${assetType}_${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await admin.storage.from('brand-assets').upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })
    if (error) throw new Error(`Asset upload failed (${assetType}): ${error.message}`)
    // Remove old file if replaced
    if (existingPath && existingPath !== path) {
      await admin.storage.from('brand-assets').remove([existingPath]).catch(() => null)
    }
    return path
  }

  try {
    const [logoPath, watermarkPath, introPath, outroPath] = await Promise.all([
      uploadAsset(formData.get('logo') as File | null, 'logo', existing.logo_path),
      uploadAsset(formData.get('watermark') as File | null, 'watermark', existing.watermark_path),
      uploadAsset(formData.get('intro') as File | null, 'intro', existing.intro_video_path),
      uploadAsset(formData.get('outro') as File | null, 'outro', existing.outro_video_path),
    ])

    if (parsed.data.is_default) {
      await admin.from('brand_templates').update({ is_default: false }).eq('user_id', user.id).neq('id', id)
    }

    const { data, error: dbError } = await admin
      .from('brand_templates')
      .update({
        name: parsed.data.name,
        primary_color: (parsed.data.primary_color as string | undefined) ?? null,
        secondary_color: (parsed.data.secondary_color as string | undefined) ?? null,
        font_family: (parsed.data.font_family as string | undefined) ?? null,
        is_default: parsed.data.is_default ?? false,
        logo_path: logoPath,
        watermark_path: watermarkPath,
        intro_video_path: introPath,
        outro_video_path: outroPath,
      })
      .eq('id', id)
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    return NextResponse.json({ data, error: null, message: 'Template mis à jour' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour'
    return NextResponse.json({ data: null, error: message, message }, { status: 500 })
  }
}
