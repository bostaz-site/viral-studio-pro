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
      account_intelligence: {
        Row: {
          best_clip_duration_range: Json | null
          best_hours: Json | null
          captions_boost_percent: number | null
          consecutive_flops: number | null
          consecutive_hits: number | null
          created_at: string | null
          current_momentum: string | null
          flop_threshold: number | null
          hot_threshold: number | null
          id: string
          last_post_at: string | null
          last_post_performance: string | null
          optimal_min_hours_between: number | null
          optimal_posts_per_day: number | null
          phase: string | null
          platform: string
          split_screen_boost_percent: number | null
          total_posts: number | null
          updated_at: string | null
          user_id: string | null
          viral_threshold: number | null
          worst_hours: Json | null
        }
        Insert: {
          best_clip_duration_range?: Json | null
          best_hours?: Json | null
          captions_boost_percent?: number | null
          consecutive_flops?: number | null
          consecutive_hits?: number | null
          created_at?: string | null
          current_momentum?: string | null
          flop_threshold?: number | null
          hot_threshold?: number | null
          id?: string
          last_post_at?: string | null
          last_post_performance?: string | null
          optimal_min_hours_between?: number | null
          optimal_posts_per_day?: number | null
          phase?: string | null
          platform: string
          split_screen_boost_percent?: number | null
          total_posts?: number | null
          updated_at?: string | null
          user_id?: string | null
          viral_threshold?: number | null
          worst_hours?: Json | null
        }
        Update: {
          best_clip_duration_range?: Json | null
          best_hours?: Json | null
          captions_boost_percent?: number | null
          consecutive_flops?: number | null
          consecutive_hits?: number | null
          created_at?: string | null
          current_momentum?: string | null
          flop_threshold?: number | null
          hot_threshold?: number | null
          id?: string
          last_post_at?: string | null
          last_post_performance?: string | null
          optimal_min_hours_between?: number | null
          optimal_posts_per_day?: number | null
          phase?: string | null
          platform?: string
          split_screen_boost_percent?: number | null
          total_posts?: number | null
          updated_at?: string | null
          user_id?: string | null
          viral_threshold?: number | null
          worst_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "account_intelligence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_snapshots: {
        Row: {
          account_id: string
          avg_views_per_video: number | null
          captured_at: string | null
          creator_rank: string | null
          creator_score: number | null
          engagement_rate: number | null
          followers: number | null
          id: number
          median_views_per_video: number | null
          platform: string
          snapshot_type: string | null
          total_views: number | null
          video_count: number | null
        }
        Insert: {
          account_id: string
          avg_views_per_video?: number | null
          captured_at?: string | null
          creator_rank?: string | null
          creator_score?: number | null
          engagement_rate?: number | null
          followers?: number | null
          id?: number
          median_views_per_video?: number | null
          platform: string
          snapshot_type?: string | null
          total_views?: number | null
          video_count?: number | null
        }
        Update: {
          account_id?: string
          avg_views_per_video?: number | null
          captured_at?: string | null
          creator_rank?: string | null
          creator_score?: number | null
          engagement_rate?: number | null
          followers?: number | null
          id?: number
          median_views_per_video?: number | null
          platform?: string
          snapshot_type?: string | null
          total_views?: number | null
          video_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "account_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_codes: {
        Row: {
          active: boolean | null
          clicks: number | null
          code: string
          commission_rate: number | null
          conversions: number | null
          created_at: string | null
          custom_handle: string | null
          id: string
          signups: number | null
          total_earned: number | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          clicks?: number | null
          code: string
          commission_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          custom_handle?: string | null
          id?: string
          signups?: number | null
          total_earned?: number | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          clicks?: number | null
          code?: string
          commission_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          custom_handle?: string | null
          id?: string
          signups?: number | null
          total_earned?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          status: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
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
      affiliates: {
        Row: {
          commission_rate: number | null
          created_at: string | null
          email: string | null
          handle: string
          id: string
          name: string
          niche: string | null
          notes: string | null
          platform: string | null
          promo_code: string | null
          promo_discount_percent: number | null
          status: string | null
          stripe_account_id: string | null
          total_clicks: number | null
          total_commission_earned: number | null
          total_commission_paid: number | null
          total_conversions: number | null
          total_revenue: number | null
          total_signups: number | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string | null
          email?: string | null
          handle: string
          id?: string
          name: string
          niche?: string | null
          notes?: string | null
          platform?: string | null
          promo_code?: string | null
          promo_discount_percent?: number | null
          status?: string | null
          stripe_account_id?: string | null
          total_clicks?: number | null
          total_commission_earned?: number | null
          total_commission_paid?: number | null
          total_conversions?: number | null
          total_revenue?: number | null
          total_signups?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number | null
          created_at?: string | null
          email?: string | null
          handle?: string
          id?: string
          name?: string
          niche?: string | null
          notes?: string | null
          platform?: string | null
          promo_code?: string | null
          promo_discount_percent?: number | null
          status?: string | null
          stripe_account_id?: string | null
          total_clicks?: number | null
          total_commission_earned?: number | null
          total_commission_paid?: number | null
          total_conversions?: number | null
          total_revenue?: number | null
          total_signups?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          metadata: Json | null
          page_path: string | null
          referrer: string | null
          session_id: string
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: number
          metadata?: Json | null
          page_path?: string | null
          referrer?: string | null
          session_id: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: number
          metadata?: Json | null
          page_path?: string | null
          referrer?: string | null
          session_id?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      distribution_settings: {
        Row: {
          ai_optimized: boolean | null
          caption_template: string | null
          created_at: string | null
          default_hashtags: Json | null
          id: string
          max_posts_per_day: number | null
          min_hours_between_posts: number | null
          niche: string | null
          optimal_hours: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_optimized?: boolean | null
          caption_template?: string | null
          created_at?: string | null
          default_hashtags?: Json | null
          id?: string
          max_posts_per_day?: number | null
          min_hours_between_posts?: number | null
          niche?: string | null
          optimal_hours?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_optimized?: boolean | null
          caption_template?: string | null
          created_at?: string | null
          default_hashtags?: Json | null
          id?: string
          max_posts_per_day?: number | null
          min_hours_between_posts?: number | null
          niche?: string | null
          optimal_hours?: Json | null
          updated_at?: string | null
          user_id?: string | null
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
      newsletter_leads: {
        Row: {
          confirmed: boolean | null
          created_at: string | null
          email: string
          id: string
          ip_hash: string | null
          referrer: string | null
          source: string | null
          unsubscribed_at: string | null
          user_agent: string | null
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          source?: string | null
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          source?: string | null
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_videos: number
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          monthly_processing_minutes_used: number | null
          monthly_videos_used: number | null
          plan: string | null
          referral_code: string | null
          referred_by: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_videos?: number
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          monthly_processing_minutes_used?: number | null
          monthly_videos_used?: number | null
          plan?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bonus_videos?: number
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          monthly_processing_minutes_used?: number | null
          monthly_videos_used?: number | null
          plan?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_performance: {
        Row: {
          check_count: number | null
          clip_duration_seconds: number | null
          clip_id: string
          comments: number | null
          created_at: string | null
          day_of_week: number | null
          has_captions: boolean | null
          has_split_screen: boolean | null
          hour_of_day: number | null
          id: string
          is_viral: boolean | null
          last_checked_at: string | null
          likes: number | null
          niche: string | null
          performance_score: number | null
          platform: string
          posted_at: string
          retention_rate: number | null
          scheduled_publication_id: string | null
          shares: number | null
          updated_at: string | null
          user_id: string | null
          velocity: number | null
          views_1h: number | null
          views_24h: number | null
          views_2h: number | null
          views_48h: number | null
          views_6h: number | null
          views_total: number | null
          watch_time_avg: number | null
        }
        Insert: {
          check_count?: number | null
          clip_duration_seconds?: number | null
          clip_id: string
          comments?: number | null
          created_at?: string | null
          day_of_week?: number | null
          has_captions?: boolean | null
          has_split_screen?: boolean | null
          hour_of_day?: number | null
          id?: string
          is_viral?: boolean | null
          last_checked_at?: string | null
          likes?: number | null
          niche?: string | null
          performance_score?: number | null
          platform: string
          posted_at: string
          retention_rate?: number | null
          scheduled_publication_id?: string | null
          shares?: number | null
          updated_at?: string | null
          user_id?: string | null
          velocity?: number | null
          views_1h?: number | null
          views_24h?: number | null
          views_2h?: number | null
          views_48h?: number | null
          views_6h?: number | null
          views_total?: number | null
          watch_time_avg?: number | null
        }
        Update: {
          check_count?: number | null
          clip_duration_seconds?: number | null
          clip_id?: string
          comments?: number | null
          created_at?: string | null
          day_of_week?: number | null
          has_captions?: boolean | null
          has_split_screen?: boolean | null
          hour_of_day?: number | null
          id?: string
          is_viral?: boolean | null
          last_checked_at?: string | null
          likes?: number | null
          niche?: string | null
          performance_score?: number | null
          platform?: string
          posted_at?: string
          retention_rate?: number | null
          scheduled_publication_id?: string | null
          shares?: number | null
          updated_at?: string | null
          user_id?: string | null
          velocity?: number | null
          views_1h?: number | null
          views_24h?: number | null
          views_2h?: number | null
          views_48h?: number | null
          views_6h?: number | null
          views_total?: number | null
          watch_time_avg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_performance_scheduled_publication_id_fkey"
            columns: ["scheduled_publication_id"]
            isOneToOne: false
            referencedRelation: "scheduled_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      referral_events: {
        Row: {
          affiliate_code_id: string | null
          amount: number | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          referred_user_id: string | null
        }
        Insert: {
          affiliate_code_id?: string | null
          amount?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          referred_user_id?: string | null
        }
        Update: {
          affiliate_code_id?: string | null
          amount?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          referred_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_affiliate_code_id_fkey"
            columns: ["affiliate_code_id"]
            isOneToOne: false
            referencedRelation: "affiliate_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          affiliate_id: string | null
          commission_amount: number | null
          converted_at: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          revenue_generated: number | null
          signed_up_at: string | null
          source: string
          status: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id?: string | null
          commission_amount?: number | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          revenue_generated?: number | null
          signed_up_at?: string | null
          source: string
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string | null
          commission_amount?: number | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          revenue_generated?: number | null
          signed_up_at?: string | null
          source?: string
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          idempotency_key: string | null
          max_retries: number | null
          retry_count: number | null
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
          idempotency_key?: string | null
          max_retries?: number | null
          retry_count?: number | null
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
          idempotency_key?: string | null
          max_retries?: number | null
          retry_count?: number | null
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
      saved_clips: {
        Row: {
          clip_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          clip_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          clip_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_clips_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "trending_clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_publications: {
        Row: {
          caption: string | null
          clip_id: string
          created_at: string | null
          error_message: string | null
          hashtags: string[] | null
          id: string
          platform: string
          publish_result: Json | null
          scheduled_at: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          caption?: string | null
          clip_id: string
          created_at?: string | null
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          platform: string
          publish_result?: Json | null
          scheduled_at: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          caption?: string | null
          clip_id?: string
          created_at?: string | null
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          platform?: string
          publish_result?: Json | null
          scheduled_at?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      social_accounts: {
        Row: {
          access_token: string | null
          avg_views_per_video: number | null
          connected_at: string | null
          creator_rank: string | null
          creator_score: number | null
          engagement_rate: number | null
          followers: number | null
          id: string
          last_sync_date: string | null
          last_synced_at: string | null
          median_views_per_video: number | null
          platform: string
          platform_user_id: string | null
          primary_niche: string | null
          refresh_token: string | null
          sync_count_today: number | null
          token_expires_at: string | null
          total_views: number | null
          user_id: string | null
          username: string | null
          video_count: number | null
        }
        Insert: {
          access_token?: string | null
          avg_views_per_video?: number | null
          connected_at?: string | null
          creator_rank?: string | null
          creator_score?: number | null
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          last_sync_date?: string | null
          last_synced_at?: string | null
          median_views_per_video?: number | null
          platform: string
          platform_user_id?: string | null
          primary_niche?: string | null
          refresh_token?: string | null
          sync_count_today?: number | null
          token_expires_at?: string | null
          total_views?: number | null
          user_id?: string | null
          username?: string | null
          video_count?: number | null
        }
        Update: {
          access_token?: string | null
          avg_views_per_video?: number | null
          connected_at?: string | null
          creator_rank?: string | null
          creator_score?: number | null
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          last_sync_date?: string | null
          last_synced_at?: string | null
          median_views_per_video?: number | null
          platform?: string
          platform_user_id?: string | null
          primary_niche?: string | null
          refresh_token?: string | null
          sync_count_today?: number | null
          token_expires_at?: string | null
          total_views?: number | null
          user_id?: string | null
          username?: string | null
          video_count?: number | null
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
      streamers: {
        Row: {
          active: boolean | null
          avg_clip_velocity: number | null
          avg_clip_views: number | null
          created_at: string | null
          display_name: string
          fetch_interval_minutes: number | null
          id: string
          kick_login: string | null
          kick_slug: string | null
          last_fetched_at: string | null
          niche: string | null
          priority: number | null
          total_clips_tracked: number | null
          twitch_id: string | null
          twitch_login: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          avg_clip_velocity?: number | null
          avg_clip_views?: number | null
          created_at?: string | null
          display_name: string
          fetch_interval_minutes?: number | null
          id?: string
          kick_login?: string | null
          kick_slug?: string | null
          last_fetched_at?: string | null
          niche?: string | null
          priority?: number | null
          total_clips_tracked?: number | null
          twitch_id?: string | null
          twitch_login?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          avg_clip_velocity?: number | null
          avg_clip_views?: number | null
          created_at?: string | null
          display_name?: string
          fetch_interval_minutes?: number | null
          id?: string
          kick_login?: string | null
          kick_slug?: string | null
          last_fetched_at?: string | null
          niche?: string | null
          priority?: number | null
          total_clips_tracked?: number | null
          twitch_id?: string | null
          twitch_login?: string | null
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
          anomaly_score: number | null
          author_handle: string | null
          author_name: string | null
          clip_created_at: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          early_signal_score: number | null
          engagement_score: number | null
          export_count: number | null
          external_url: string
          feed_category: string | null
          format_score: number | null
          id: string
          like_count: number | null
          momentum_score: number | null
          next_check_at: string | null
          niche: string | null
          platform: string
          prev_momentum_score: number | null
          recency_score: number | null
          saturation_score: number | null
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
        }
        Insert: {
          anomaly_score?: number | null
          author_handle?: string | null
          author_name?: string | null
          clip_created_at?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          early_signal_score?: number | null
          engagement_score?: number | null
          export_count?: number | null
          external_url: string
          feed_category?: string | null
          format_score?: number | null
          id?: string
          like_count?: number | null
          momentum_score?: number | null
          next_check_at?: string | null
          niche?: string | null
          platform: string
          prev_momentum_score?: number | null
          recency_score?: number | null
          saturation_score?: number | null
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
        }
        Update: {
          anomaly_score?: number | null
          author_handle?: string | null
          author_name?: string | null
          clip_created_at?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          early_signal_score?: number | null
          engagement_score?: number | null
          export_count?: number | null
          external_url?: string
          feed_category?: string | null
          format_score?: number | null
          id?: string
          like_count?: number | null
          momentum_score?: number | null
          next_check_at?: string | null
          niche?: string | null
          platform?: string
          prev_momentum_score?: number | null
          recency_score?: number | null
          saturation_score?: number | null
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
      bulk_update_scores: {
        Args: {
          p_anomaly_scores: number[]
          p_early_signal_scores: number[]
          p_engagement_scores: number[]
          p_feed_categories: string[]
          p_format_scores: number[]
          p_ids: string[]
          p_momentum_scores: number[]
          p_next_check_ats: string[]
          p_recency_scores: number[]
          p_saturation_scores: number[]
          p_tiers: string[]
          p_velocity_scores: number[]
        }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { p_identifier: string; p_limit: number; p_window_ms: number }
        Returns: boolean
      }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      decrement_video_usage: { Args: { p_user_id: string }; Returns: boolean }
      generate_referral_code: { Args: never; Returns: string }
      increment_export_count: {
        Args: { p_clip_id: string }
        Returns: undefined
      }
      increment_video_usage: {
        Args: { p_max_videos: number; p_user_id: string }
        Returns: boolean
      }
      try_consume_video_credit: {
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
