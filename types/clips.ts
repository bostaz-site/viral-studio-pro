export interface ViralScore {
  score: number | null
  hook_strength: number | null
  emotional_flow: number | null
  perceived_value: number | null
  trend_alignment: number | null
  hook_type: string | null
  explanation: string | null
  suggested_hooks: unknown
}

export interface GeneratedClip {
  id: string
  video_id: string | null
  user_id: string | null
  title: string | null
  start_time: number
  end_time: number
  duration_seconds: number | null
  storage_path: string | null
  thumbnail_path: string | null
  thumbnail_url: string | null
  transcript_segment: string | null
  caption_template: string | null
  aspect_ratio: string | null
  status: string | null
  error_message: string | null
  is_remake: boolean | null
  parent_clip_id: string | null
  created_at: string | null
  updated_at: string | null
  viral_scores: ViralScore[]
}
