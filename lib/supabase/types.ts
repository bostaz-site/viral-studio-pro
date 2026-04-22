export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      affiliates: {
        Row: {
          id: string
          name: string
          email: string | null
          handle: string
          platform: string | null
          niche: string | null
          commission_rate: number | null
          promo_code: string | null
          promo_discount_percent: number | null
          status: string | null
          notes: string | null
          total_clicks: number | null
          total_signups: number | null
          total_conversions: number | null
          total_revenue: number | null
          total_commission_earned: number | null
          total_commission_paid: number | null
          stripe_account_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          handle: string
          platform?: string | null
          niche?: string | null
          commission_rate?: number | null
          promo_code?: string | null
          promo_discount_percent?: number | null
          status?: string | null
          notes?: string | null
          total_clicks?: number | null
          total_signups?: number | null
          total_conversions?: number | null
          total_revenue?: number | null
          total_commission_earned?: number | null
          total_commission_paid?: number | null
          stripe_account_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          handle?: string
          platform?: string | null
          niche?: string | null
          commission_rate?: number | null
          promo_code?: string | null
          promo_discount_percent?: number | null
          status?: string | null
          notes?: string | null
          total_clicks?: number | null
          total_signups?: number | null
          total_conversions?: number | null
          total_revenue?: number | null
          total_commission_earned?: number | null
          total_commission_paid?: number | null
          stripe_account_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      account_intelligence: {
        Row: {
          id: string
          user_id: string
          platform: string
          phase: string
          total_posts: number
          best_hours: Json
          worst_hours: Json
          optimal_posts_per_day: number | null
          optimal_min_hours_between: number | null
          best_clip_duration_range: Json | null
          captions_boost_percent: number | null
          split_screen_boost_percent: number | null
          last_post_performance: string | null
          last_post_at: string | null
          consecutive_flops: number
          consecutive_hits: number
          current_momentum: string
          hot_threshold: number
          viral_threshold: number
          flop_threshold: number
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          phase?: string
          total_posts?: number
          best_hours?: Json
          worst_hours?: Json
          optimal_posts_per_day?: number | null
          optimal_min_hours_between?: number | null
          best_clip_duration_range?: Json | null
          captions_boost_percent?: number | null
          split_screen_boost_percent?: number | null
          last_post_performance?: string | null
          last_post_at?: string | null
          consecutive_flops?: number
          consecutive_hits?: number
          current_momentum?: string
          hot_threshold?: number
          viral_threshold?: number
          flop_threshold?: number
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          phase?: string
          total_posts?: number
          best_hours?: Json
          worst_hours?: Json
          optimal_posts_per_day?: number | null
          optimal_min_hours_between?: number | null
          best_clip_duration_range?: Json | null
          captions_boost_percent?: number | null
          split_screen_boost_percent?: number | null
          last_post_performance?: string | null
          last_post_at?: string | null
          consecutive_flops?: number
          consecutive_hits?: number
          current_momentum?: string
          hot_threshold?: number
          viral_threshold?: number
          flop_threshold?: number
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      affiliate_payouts: {
        Row: {
          id: string
          affiliate_id: string | null
          amount: number
          currency: string | null
          status: string | null
          payment_method: string | null
          stripe_transfer_id: string | null
          notes: string | null
          period_start: string | null
          period_end: string | null
          paid_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          affiliate_id?: string | null
          amount: number
          currency?: string | null
          status?: string | null
          payment_method?: string | null
          stripe_transfer_id?: string | null
          notes?: string | null
          period_start?: string | null
          period_end?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          affiliate_id?: string | null
          amount?: number
          currency?: string | null
          status?: string | null
          payment_method?: string | null
          stripe_transfer_id?: string | null
          notes?: string | null
          period_start?: string | null
          period_end?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_templates: {
        Row: {
          created_at: string | null
          font_family: string | null
          id: string
          intro_video_path: string | null
          is_default: boolean | null
          logo_path: string | null
          name: string
          outro_video_path: string | null
          primary_color: string | null
          secondary_color: string | null
          user_id: string | null
          watermark_path: string | null
        }
        Insert: {
          created_at?: string | null
          font_family?: string | null
          id?: string
          intro_video_path?: string | null
          is_default?: boolean | null
          logo_path?: string | null
          name: string
          outro_video_path?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          user_id?: string | null
          watermark_path?: string | null
        }
        Update: {
          created_at?: string | null
          font_family?: string | null
          id?: string
          intro_video_path?: string | null
          is_default?: boolean | null
          logo_path?: string | null
          name?: string
          outro_video_path?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          user_id?: string | null
          watermark_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_snapshots: {
        Row: {
          captured_at: string
          clip_id: string
          id: number
          view_count: number
        }
        Insert: {
          captured_at?: string
          clip_id: string
          id?: number
          view_count: number
        }
        Update: {
          captured_at?: string
          clip_id?: string
          id?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "clip_snapshots_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "trending_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          aspect_ratio: string | null
          caption_template: string | null
          created_at: string | null
          duration_seconds: number | null
          end_time: number
          error_message: string | null
          id: string
          is_remake: boolean | null
          parent_clip_id: string | null
          start_time: number
          status: string | null
          storage_path: string | null
          thumbnail_path: string | null
          title: string | null
          transcript_segment: string | null
          updated_at: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          caption_template?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_time: number
          error_message?: string | null
          id?: string
          is_remake?: boolean | null
          parent_clip_id?: string | null
          start_time: number
          status?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          title?: string | null
          transcript_segment?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          caption_template?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: number
          error_message?: string | null
          id?: string
          is_remake?: boolean | null
          parent_clip_id?: string | null
          start_time?: number
          status?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          title?: string | null
          transcript_segment?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_parent_clip_id_fkey"
            columns: ["parent_clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          monthly_processing_minutes_used: number | null
          monthly_videos_used: number | null
          plan: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          monthly_processing_minutes_used?: number | null
          monthly_videos_used?: number | null
          plan?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          monthly_processing_minutes_used?: number | null
          monthly_videos_used?: number | null
          plan?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      publication_performance: {
        Row: {
          id: string
          user_id: string
          scheduled_publication_id: string | null
          clip_id: string
          platform: string
          views_1h: number
          views_2h: number
          views_6h: number
          views_24h: number
          views_48h: number
          views_total: number
          likes: number
          comments: number
          shares: number
          watch_time_avg: number | null
          retention_rate: number | null
          posted_at: string
          day_of_week: number
          hour_of_day: number
          niche: string | null
          has_captions: boolean
          has_split_screen: boolean
          clip_duration_seconds: number | null
          performance_score: number | null
          is_viral: boolean
          velocity: number | null
          last_checked_at: string | null
          check_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          scheduled_publication_id?: string | null
          clip_id: string
          platform: string
          views_1h?: number
          views_2h?: number
          views_6h?: number
          views_24h?: number
          views_48h?: number
          views_total?: number
          likes?: number
          comments?: number
          shares?: number
          watch_time_avg?: number | null
          retention_rate?: number | null
          posted_at: string
          day_of_week?: number
          hour_of_day?: number
          niche?: string | null
          has_captions?: boolean
          has_split_screen?: boolean
          clip_duration_seconds?: number | null
          performance_score?: number | null
          is_viral?: boolean
          velocity?: number | null
          last_checked_at?: string | null
          check_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          scheduled_publication_id?: string | null
          clip_id?: string
          platform?: string
          views_1h?: number
          views_2h?: number
          views_6h?: number
          views_24h?: number
          views_48h?: number
          views_total?: number
          likes?: number
          comments?: number
          shares?: number
          watch_time_avg?: number | null
          retention_rate?: number | null
          posted_at?: string
          day_of_week?: number
          hour_of_day?: number
          niche?: string | null
          has_captions?: boolean
          has_split_screen?: boolean
          clip_duration_seconds?: number | null
          performance_score?: number | null
          is_viral?: boolean
          velocity?: number | null
          last_checked_at?: string | null
          check_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          caption: string | null
          clip_id: string | null
          created_at: string | null
          hashtags: string[] | null
          id: string
          platform: string
          platform_post_id: string | null
          published_at: string | null
          scheduled_at: string | null
          social_account_id: string | null
          status: string | null
          tracking_url: string | null
        }
        Insert: {
          caption?: string | null
          clip_id?: string | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          platform: string
          platform_post_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: string | null
          status?: string | null
          tracking_url?: string | null
        }
        Update: {
          caption?: string | null
          clip_id?: string | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          platform?: string
          platform_post_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: string | null
          status?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          created_at: string | null
          id: number
          identifier: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          identifier: string
        }
        Update: {
          created_at?: string | null
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          id: string
          affiliate_id: string | null
          user_id: string | null
          source: string
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          status: string | null
          signed_up_at: string | null
          converted_at: string | null
          revenue_generated: number | null
          commission_amount: number | null
          ip_address: string | null
          user_agent: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          affiliate_id?: string | null
          user_id?: string | null
          source: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          status?: string | null
          signed_up_at?: string | null
          converted_at?: string | null
          revenue_generated?: number | null
          commission_amount?: number | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          affiliate_id?: string | null
          user_id?: string | null
          source?: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          status?: string | null
          signed_up_at?: string | null
          converted_at?: string | null
          revenue_generated?: number | null
          commission_amount?: number | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      render_jobs: {
        Row: {
          clip_id: string
          clip_url: string | null
          created_at: string | null
          debug_log: string | null
          error_message: string | null
          id: string
          source: string
          status: string
          storage_path: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          clip_id: string
          clip_url?: string | null
          created_at?: string | null
          debug_log?: string | null
          error_message?: string | null
          id?: string
          source?: string
          status?: string
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          clip_id?: string
          clip_url?: string | null
          created_at?: string | null
          debug_log?: string | null
          error_message?: string | null
          id?: string
          source?: string
          status?: string
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          connected_at: string | null
          id: string
          platform: string
          platform_user_id: string | null
          refresh_token: string | null
          token_expires_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          id?: string
          platform: string
          platform_user_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          id?: string
          platform?: string
          platform_user_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_clips: {
        Row: {
          id: string
          user_id: string
          clip_id: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clip_id: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clip_id?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      streamers: {
        Row: {
          active: boolean | null
          created_at: string | null
          display_name: string
          id: string
          kick_slug: string | null
          kick_login: string | null
          priority: number | null
          twitch_id: string | null
          twitch_login: string | null
          niche: string | null
          avg_clip_views: number | null
          avg_clip_velocity: number | null
          total_clips_tracked: number | null
          last_fetched_at: string | null
          fetch_interval_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          display_name: string
          id?: string
          kick_slug?: string | null
          kick_login?: string | null
          priority?: number | null
          twitch_id?: string | null
          twitch_login?: string | null
          niche?: string | null
          avg_clip_views?: number | null
          avg_clip_velocity?: number | null
          total_clips_tracked?: number | null
          last_fetched_at?: string | null
          fetch_interval_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          display_name?: string
          id?: string
          kick_slug?: string | null
          kick_login?: string | null
          priority?: number | null
          twitch_id?: string | null
          twitch_login?: string | null
          niche?: string | null
          avg_clip_views?: number | null
          avg_clip_velocity?: number | null
          total_clips_tracked?: number | null
          last_fetched_at?: string | null
          fetch_interval_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          created_at: string | null
          full_text: string
          id: string
          language: string | null
          segments: Json
          speakers: Json | null
          video_id: string | null
          word_timestamps: Json | null
        }
        Insert: {
          created_at?: string | null
          full_text: string
          id?: string
          language?: string | null
          segments: Json
          speakers?: Json | null
          video_id?: string | null
          word_timestamps?: Json | null
        }
        Update: {
          created_at?: string | null
          full_text?: string
          id?: string
          language?: string | null
          segments?: Json
          speakers?: Json | null
          video_id?: string | null
          word_timestamps?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transcriptions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_clips: {
        Row: {
          author_handle: string | null
          author_name: string | null
          clip_created_at: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          external_url: string
          id: string
          like_count: number | null
          niche: string | null
          platform: string
          scraped_at: string | null
          streamer_id: string | null
          thumbnail_url: string | null
          tier: string | null
          title: string | null
          twitch_clip_id: string | null
          velocity: number | null
          velocity_score: number | null
          view_count: number | null
          viral_ratio: number | null
          viral_score: number | null
          early_signal_score: number | null
          anomaly_score: number | null
          feed_category: string | null
        }
        Insert: {
          author_handle?: string | null
          author_name?: string | null
          clip_created_at?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url: string
          id?: string
          like_count?: number | null
          niche?: string | null
          platform: string
          scraped_at?: string | null
          streamer_id?: string | null
          thumbnail_url?: string | null
          tier?: string | null
          title?: string | null
          twitch_clip_id?: string | null
          velocity?: number | null
          velocity_score?: number | null
          view_count?: number | null
          viral_ratio?: number | null
          viral_score?: number | null
          early_signal_score?: number | null
          anomaly_score?: number | null
          feed_category?: string | null
        }
        Update: {
          author_handle?: string | null
          author_name?: string | null
          clip_created_at?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string
          id?: string
          like_count?: number | null
          niche?: string | null
          platform?: string
          scraped_at?: string | null
          streamer_id?: string | null
          thumbnail_url?: string | null
          tier?: string | null
          title?: string | null
          twitch_clip_id?: string | null
          velocity?: number | null
          velocity_score?: number | null
          view_count?: number | null
          viral_ratio?: number | null
          viral_score?: number | null
          early_signal_score?: number | null
          anomaly_score?: number | null
          feed_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trending_clips_streamer_id_fkey"
            columns: ["streamer_id"]
            isOneToOne: false
            referencedRelation: "streamers"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          source_platform: string | null
          source_url: string | null
          status: string | null
          storage_path: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string | null
          storage_path: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string | null
          storage_path?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_publications: {
        Row: {
          id: string
          user_id: string | null
          clip_id: string
          platform: string
          caption: string | null
          hashtags: string[] | null
          scheduled_at: string
          status: string | null
          publish_result: Json | null
          error_message: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          clip_id: string
          platform: string
          caption?: string | null
          hashtags?: string[] | null
          scheduled_at: string
          status?: string | null
          publish_result?: Json | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          clip_id?: string
          platform?: string
          caption?: string | null
          hashtags?: string[] | null
          scheduled_at?: string
          status?: string | null
          publish_result?: Json | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_publications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_settings: {
        Row: {
          id: string
          user_id: string | null
          max_posts_per_day: number | null
          min_hours_between_posts: number | null
          default_hashtags: Json | null
          caption_template: string | null
          niche: string | null
          optimal_hours: Json | null
          ai_optimized: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          max_posts_per_day?: number | null
          min_hours_between_posts?: number | null
          default_hashtags?: Json | null
          caption_template?: string | null
          niche?: string | null
          optimal_hours?: Json | null
          ai_optimized?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          max_posts_per_day?: number | null
          min_hours_between_posts?: number | null
          default_hashtags?: Json | null
          caption_template?: string | null
          niche?: string | null
          optimal_hours?: Json | null
          ai_optimized?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_scores: {
        Row: {
          clip_id: string | null
          created_at: string | null
          emotional_flow: number | null
          explanation: string | null
          hook_strength: number | null
          hook_type: string | null
          id: string
          perceived_value: number | null
          score: number | null
          suggested_hooks: Json | null
          trend_alignment: number | null
        }
        Insert: {
          clip_id?: string | null
          created_at?: string | null
          emotional_flow?: number | null
          explanation?: string | null
          hook_strength?: number | null
          hook_type?: string | null
          id?: string
          perceived_value?: number | null
          score?: number | null
          suggested_hooks?: Json | null
          trend_alignment?: number | null
        }
        Update: {
          clip_id?: string | null
          created_at?: string | null
          emotional_flow?: number | null
          explanation?: string | null
          hook_strength?: number | null
          hook_type?: string | null
          id?: string
          perceived_value?: number | null
          score?: number | null
          suggested_hooks?: Json | null
          trend_alignment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "viral_scores_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_identifier: string; p_limit: number; p_window_ms: number }
        Returns: boolean
      }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      decrement_video_usage: { Args: { p_user_id: string }; Returns: boolean }
      increment_video_usage: {
        Args: { p_max_videos: number; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
