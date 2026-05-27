/**
 * TikTok Content Posting API types.
 *
 * Based on TikTok's Content Sharing Developer Guidelines:
 * https://developers.tiktok.com/doc/content-sharing-guidelines
 */

// ── Creator Info ─────────────────────────────────────────────────────────────

export type TikTokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY'

export interface TikTokCreatorInfo {
  creator_avatar_url: string
  creator_nickname: string
  creator_username: string
  privacy_level_options: TikTokPrivacyLevel[]
  comment_disabled: boolean
  duet_disabled: boolean
  stitch_disabled: boolean
  max_video_post_duration_sec: number
}

export interface TikTokCreatorInfoResponse {
  data: {
    creator_avatar_url: string
    creator_nickname: string
    creator_username: string
    privacy_level_options: TikTokPrivacyLevel[]
    comment_disabled: boolean
    duet_disabled: boolean
    stitch_disabled: boolean
    max_video_post_duration_sec: number
  }
  error: {
    code: string
    message: string
    log_id: string
  }
}

// ── Publish ──────────────────────────────────────────────────────────────────

export interface TikTokPublishRequest {
  post_info: {
    title: string
    privacy_level: TikTokPrivacyLevel
    disable_duet: boolean
    disable_comment: boolean
    disable_stitch: boolean
    video_cover_timestamp_ms?: number
    brand_content_toggle?: boolean
    brand_organic_toggle?: boolean
  }
  source_info: {
    source: 'PULL_FROM_URL' | 'FILE_UPLOAD'
    video_url?: string
    video_size?: number
    chunk_size?: number
    total_chunk_count?: number
  }
}

export interface TikTokPublishResponse {
  data: {
    publish_id: string
  }
  error: {
    code: string
    message: string
    log_id: string
  }
}

// ── Publish Status ───────────────────────────────────────────────────────────

export type TikTokPublishStatus =
  | 'PROCESSING_UPLOAD'
  | 'PROCESSING_DOWNLOAD'
  | 'SEND_TO_USER_INBOX'
  | 'PUBLISH_COMPLETE'
  | 'FAILED'

export interface TikTokPublishStatusResponse {
  data: {
    status: TikTokPublishStatus
    fail_reason?: string
    publicaly_available_post_id?: string[]
    uploaded_bytes?: number
  }
  error: {
    code: string
    message: string
    log_id: string
  }
}

// ── Dialog State ─────────────────────────────────────────────────────────────

export interface TikTokPublishDialogState {
  creatorInfo: TikTokCreatorInfo | null
  creatorInfoLoading: boolean
  creatorInfoError: string | null

  // Form fields
  title: string
  privacyLevel: TikTokPrivacyLevel | null
  allowComment: boolean
  allowDuet: boolean
  allowStitch: boolean

  // Commercial content
  commercialContentEnabled: boolean
  brandOrganic: boolean   // "Your Brand" — promotional content
  brandContent: boolean   // "Branded Content" — paid partnership

  // Publish status
  publishId: string | null
  publishStatus: TikTokPublishStatus | null
  publishError: string | null
  isPublishing: boolean
}

export const PRIVACY_LEVEL_LABELS: Record<TikTokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: 'Public',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
}
