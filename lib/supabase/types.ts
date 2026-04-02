export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Standalone row types to avoid circular references in Database interface
type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  plan: string | null
  monthly_videos_used: number | null
  created_at: string | null
  updated_at: string | null
}

type VideoRow = {
  id: string
  user_id: string | null
  title: string
  description: string | null
  source_url: string | null
  source_platform: string | null
  storage_path: string
  duration_seconds: number | null
  file_size_bytes: number | null
  mime_type: string | null
  status: string | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

type TranscriptionRow = {
  id: string
  video_id: string | null
  language: string | null
  full_text: string
  segments: Json
  word_timestamps: Json | null
  speakers: Json | null
  created_at: string | null
}

type ClipRow = {
  id: string
  video_id: string | null
  user_id: string | null
  title: string | null
  start_time: number
  end_time: number
  duration_seconds: number | null
  storage_path: string | null
  thumbnail_path: string | null
  transcript_segment: string | null
  caption_template: string | null
  aspect_ratio: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

type ViralScoreRow = {
  id: string
  clip_id: string | null
  score: number | null
  hook_strength: number | null
  emotional_flow: number | null
  perceived_value: number | null
  trend_alignment: number | null
  hook_type: string | null
  explanation: string | null
  suggested_hooks: Json | null
  created_at: string | null
}

type TrendingClipRow = {
  id: string
  external_url: string
  platform: string
  author_name: string | null
  author_handle: string | null
  title: string | null
  description: string | null
  niche: string | null
  view_count: number | null
  like_count: number | null
  velocity_score: number | null
  thumbnail_url: string | null
  scraped_at: string | null
  created_at: string | null
}


export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string; email: string }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      videos: {
        Row: VideoRow
        Insert: Partial<VideoRow> & { title: string; storage_path: string }
        Update: Partial<VideoRow>
        Relationships: []
      }
      transcriptions: {
        Row: TranscriptionRow
        Insert: Partial<TranscriptionRow> & { full_text: string; segments: Json }
        Update: Partial<TranscriptionRow>
        Relationships: []
      }
      clips: {
        Row: ClipRow
        Insert: Partial<ClipRow> & { start_time: number; end_time: number }
        Update: Partial<ClipRow>
        Relationships: []
      }
      viral_scores: {
        Row: ViralScoreRow
        Insert: Partial<ViralScoreRow>
        Update: Partial<ViralScoreRow>
        Relationships: []
      }
      trending_clips: {
        Row: TrendingClipRow
        Insert: Partial<TrendingClipRow> & { external_url: string; platform: string }
        Update: Partial<TrendingClipRow>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
