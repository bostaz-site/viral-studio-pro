import { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/withAdmin'
import { jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { validateContact } from '@/lib/admin/compliance/contact-validator'

// POST /api/admin/compliance/check — validate a contact before action
export const POST = withAdmin(async (req: NextRequest, user) => {
  const body = await req.json()
  const { email, handle, platform, profileUrl, sourceUrl, intent } = body as {
    email?: string
    handle?: string
    platform?: string
    profileUrl?: string
    sourceUrl?: string
    intent: 'import' | 'export_campaign' | 'send_email' | 'add_to_kit'
  }

  if (!intent) return errorResponse('intent is required')

  const result = await validateContact({
    email,
    handle,
    platform,
    profileUrl,
    sourceUrl,
    intent,
    triggeredBy: user.id,
  })

  return jsonResponse(result)
})
