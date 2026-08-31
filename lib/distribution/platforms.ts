/**
 * Platform configurations for OAuth + Publishing.
 *
 * Each platform defines its OAuth URLs, scopes, token endpoints,
 * and publish endpoints used by the distribution module.
 */

export type Platform = 'tiktok' | 'youtube' | 'instagram' | 'facebook'

export interface PlatformConfig {
  name: string
  displayName: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  redirectUri: string
  clientIdEnv: string
  clientSecretEnv: string
  color: string
  icon: string
  supportsPublish: boolean
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://viralanimal.com'

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  tiktok: {
    name: 'tiktok',
    displayName: 'TikTok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish', 'video.upload', 'video.list'],
    redirectUri: `${APP_URL}/api/auth/callback/tiktok`,
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    color: '#000000',
    icon: 'tiktok',
    supportsPublish: true,
  },
  youtube: {
    name: 'youtube',
    displayName: 'YouTube',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    redirectUri: `${APP_URL}/api/auth/callback/youtube`,
    clientIdEnv: 'YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'YOUTUBE_CLIENT_SECRET',
    color: '#FF0000',
    icon: 'youtube',
    supportsPublish: true,
  },
  instagram: {
    name: 'instagram',
    displayName: 'Instagram',
    // Instagram API with Instagram Login (NOT Facebook Login)
    authUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: [
      'instagram_business_basic',
      'instagram_business_content_publish',
    ],
    redirectUri: `${APP_URL}/api/auth/callback/instagram`,
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
    color: '#E4405F',
    icon: 'instagram',
    supportsPublish: true,
  },
  facebook: {
    name: 'facebook',
    displayName: 'Facebook Reels',
    // Facebook Login for Business
    authUrl: 'https://www.facebook.com/v25.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v25.0/oauth/access_token',
    scopes: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'business_management',
    ],
    redirectUri: `${APP_URL}/api/auth/callback/facebook`,
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    color: '#1877F2',
    icon: 'facebook',
    supportsPublish: true,
  },
}

export const SUPPORTED_PLATFORMS: Platform[] = ['tiktok', 'youtube', 'instagram', 'facebook']

/**
 * Validate that a string is a supported platform.
 */
export function isPlatform(value: string): value is Platform {
  return SUPPORTED_PLATFORMS.includes(value as Platform)
}

/**
 * Get client credentials for a platform from env vars.
 * Throws if not configured.
 */
export function getClientCredentials(platform: Platform): {
  clientId: string
  clientSecret: string
} {
  const config = PLATFORM_CONFIGS[platform]
  const clientId = process.env[config.clientIdEnv]
  const clientSecret = process.env[config.clientSecretEnv]

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing OAuth credentials for ${config.displayName}. ` +
      `Set ${config.clientIdEnv} and ${config.clientSecretEnv} in your environment.`
    )
  }

  return { clientId, clientSecret }
}

/**
 * Build the OAuth authorization URL for a given platform.
 */
export function buildAuthUrl(
  platform: Platform,
  state: string
): string {
  const config = PLATFORM_CONFIGS[platform]
  const { clientId } = getClientCredentials(platform)

  const params = new URLSearchParams()

  switch (platform) {
    case 'tiktok':
      params.set('client_key', clientId)
      params.set('response_type', 'code')
      params.set('scope', config.scopes.join(','))
      params.set('redirect_uri', config.redirectUri)
      params.set('state', state)
      params.set('lang_type', 'en')
      return `${config.authUrl}?${params.toString()}`

    case 'youtube':
      params.set('client_id', clientId)
      params.set('response_type', 'code')
      params.set('scope', config.scopes.join(' '))
      params.set('redirect_uri', config.redirectUri)
      params.set('state', state)
      params.set('access_type', 'offline')
      params.set('prompt', 'consent')
      return `${config.authUrl}?${params.toString()}`

    case 'instagram':
      // Instagram API with Instagram Login — comma-separated scopes
      params.set('client_id', clientId)
      params.set('response_type', 'code')
      params.set('scope', config.scopes.join(','))
      params.set('redirect_uri', config.redirectUri)
      params.set('state', state)
      params.set('enable_fb_login', '0')
      params.set('force_authentication', '0')
      return `${config.authUrl}?${params.toString()}`

    case 'facebook':
      // Facebook Login for Business — comma-separated scopes
      params.set('client_id', clientId)
      params.set('response_type', 'code')
      params.set('scope', config.scopes.join(','))
      params.set('redirect_uri', config.redirectUri)
      params.set('state', state)
      return `${config.authUrl}?${params.toString()}`

    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
