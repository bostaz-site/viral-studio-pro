import { z } from 'zod'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClientUntyped } from '@/lib/supabase/admin-untyped'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  target_niches: z.array(z.string()).optional(),
  target_platforms: z.array(z.string()).optional(),
  mailbox_id: z.string().uuid().optional(),
  subject_template: z.string().max(500).optional(),
  body_template: z.string().max(10000).optional(),
})

// GET - list campaigns
export const GET = withAdmin(async (req) => {
  const supabase = createAdminClientUntyped()
  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  let query = supabase
    .from('email_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})

// POST - create campaign
export const POST = withAdmin(async (req, user) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

  const supabase = createAdminClientUntyped()
  const {
    name,
    description,
    target_niches,
    target_platforms,
    mailbox_id,
    subject_template,
    body_template,
  } = parsed.data

  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      name,
      description: description || null,
      status: 'draft',
      target_segment: {
        niches: target_niches || [],
        platforms: target_platforms || [],
        mailbox_id: mailbox_id || null,
      },
      sequence_steps: [
        {
          step_index: 0,
          subject: subject_template || '',
          body: body_template || '',
        },
      ],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return jsonResponse(data)
})
