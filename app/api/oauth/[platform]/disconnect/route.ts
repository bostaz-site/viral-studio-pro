import { NextRequest } from 'next/server'
import { withAuth, jsonResponse, errorResponse } from '@/lib/api/withAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatform, PLATFORM_CONFIGS } from '@/lib/distribution/platforms'

export const DELETE = withAuth(
  async (req: NextRequest, user) => {
    const url = new URL(req.url)
    const segments = url.pathname.split('/')
    // /api/oauth/[platform]/disconnect
    const oauthIdx = segments.indexOf('oauth')
    const platformParam = oauthIdx !== -1 ? segments[oauthIdx + 1] : undefined

    if (!platformParam || !isPlatform(platformParam)) {
      return errorResponse(`Unsupported platform: ${platformParam}`, 400)
    }

    const admin = createAdminClient()

    // Find the account
    const { data: account, error: findError } = await admin
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', platformParam)
      .single()

    if (findError || !account) {
      return errorResponse(
        `No ${PLATFORM_CONFIGS[platformParam].displayName} account connected`,
        404
      )
    }

    // Delete the account
    const { error: deleteError } = await admin
      .from('social_accounts')
      .delete()
      .eq('id', account.id)
      .eq('user_id', user.id)

    if (deleteError) {
      return errorResponse(`Failed to disconnect: ${deleteError.message}`, 500)
    }

    return jsonResponse({
      platform: platformParam,
      disconnected: true,
    })
  }
)
