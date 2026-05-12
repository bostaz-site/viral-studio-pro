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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          notes: string | null
          permissions: Json | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          notes?: string | null
          permissions?: Json | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          notes?: string | null
          permissions?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_code: string
          clicked_at: string
          fingerprint_hash: string | null
          id: string
          influencer_id: string | null
          ip_country: string | null
          ip_hash: string | null
          landing_path: string | null
          referrer_url: string | null
          signup_completed_at: string | null
          signup_user_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_code: string
          clicked_at?: string
          fingerprint_hash?: string | null
          id?: string
          influencer_id?: string | null
          ip_country?: string | null
          ip_hash?: string | null
          landing_path?: string | null
          referrer_url?: string | null
          signup_completed_at?: string | null
          signup_user_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_code?: string
          clicked_at?: string
          fingerprint_hash?: string | null
          id?: string
          influencer_id?: string | null
          ip_country?: string | null
          ip_hash?: string | null
          landing_path?: string | null
          referrer_url?: string | null
          signup_completed_at?: string | null
          signup_user_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
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
      affiliate_commission_ledger: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          event_type: string
          id: string
          influencer_id: string
          notes: string | null
          payout_id: string | null
          referral_id: string | null
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          user_id: string | null
          webhook_event_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          event_type: string
          id?: string
          influencer_id: string
          notes?: string | null
          payout_id?: string | null
          referral_id?: string | null
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          user_id?: string | null
          webhook_event_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          event_type?: string
          id?: string
          influencer_id?: string
          notes?: string | null
          payout_id?: string | null
          referral_id?: string | null
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          user_id?: string | null
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_ledger_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          adjustments_cents: number | null
          created_at: string
          failure_reason: string | null
          gross_commission_cents: number
          id: string
          included_referral_ids: string[] | null
          influencer_id: string
          net_payout_cents: number
          period_end_at: string
          period_start_at: string
          referrals_count: number
          sent_at: string | null
          status: string
          stripe_transfer_id: string | null
          stripe_transfer_status: string | null
          updated_at: string
        }
        Insert: {
          adjustments_cents?: number | null
          created_at?: string
          failure_reason?: string | null
          gross_commission_cents: number
          id?: string
          included_referral_ids?: string[] | null
          influencer_id: string
          net_payout_cents: number
          period_end_at: string
          period_start_at: string
          referrals_count: number
          sent_at?: string | null
          status?: string
          stripe_transfer_id?: string | null
          stripe_transfer_status?: string | null
          updated_at?: string
        }
        Update: {
          adjustments_cents?: number | null
          created_at?: string
          failure_reason?: string | null
          gross_commission_cents?: number
          id?: string
          included_referral_ids?: string[] | null
          influencer_id?: string
          net_payout_cents?: number
          period_end_at?: string
          period_start_at?: string
          referrals_count?: number
          sent_at?: string | null
          status?: string
          stripe_transfer_id?: string | null
          stripe_transfer_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          attribution_metadata: Json | null
          attribution_type: string
          created_at: string
          first_paid_at: string | null
          id: string
          influencer_id: string
          signed_up_at: string
          status: string
          total_commission_cents: number | null
          total_revenue_cents: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attribution_metadata?: Json | null
          attribution_type: string
          created_at?: string
          first_paid_at?: string | null
          id?: string
          influencer_id: string
          signed_up_at?: string
          status?: string
          total_commission_cents?: number | null
          total_revenue_cents?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attribution_metadata?: Json | null
          attribution_type?: string
          created_at?: string
          first_paid_at?: string | null
          id?: string
          influencer_id?: string
          signed_up_at?: string
          status?: string
          total_commission_cents?: number | null
          total_revenue_cents?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
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
      ai_calls: {
        Row: {
          cached_tokens: number | null
          context_id: string | null
          context_type: string | null
          cost_usd: number | null
          created_at: string
          error: string | null
          feature: string
          id: number
          latency_ms: number | null
          metadata: Json | null
          model: string
          success: boolean | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          cached_tokens?: number | null
          context_id?: string | null
          context_type?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: number
          latency_ms?: number | null
          metadata?: Json | null
          model: string
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          cached_tokens?: number | null
          context_id?: string | null
          context_type?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: number
          latency_ms?: number | null
          metadata?: Json | null
          model?: string
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          external_id: string | null
          id: string
          influencer_id: string
          last_event_at: string | null
          mailbox_id: string | null
          scheduled_at: string | null
          sent_at: string | null
          sequence_step: number | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          influencer_id: string
          last_event_at?: string | null
          mailbox_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_step?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          influencer_id?: string
          last_event_at?: string | null
          mailbox_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sequence_step?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
          {
            foreignKeyName: "campaign_recipients_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "v_mailboxes_safe"
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
      demo_packages: {
        Row: {
          avg_viral_score: number | null
          created_at: string
          expires_at: string | null
          generated_at: string | null
          id: string
          influencer_id: string
          landing_page_first_visit_at: string | null
          landing_page_slug: string | null
          landing_page_visits: number | null
          selected_clip_ids: string[] | null
          shared_at: string | null
          source_clips: Json | null
          status: string
          total_render_cost_cents: number | null
        }
        Insert: {
          avg_viral_score?: number | null
          created_at?: string
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          influencer_id: string
          landing_page_first_visit_at?: string | null
          landing_page_slug?: string | null
          landing_page_visits?: number | null
          selected_clip_ids?: string[] | null
          shared_at?: string | null
          source_clips?: Json | null
          status?: string
          total_render_cost_cents?: number | null
        }
        Update: {
          avg_viral_score?: number | null
          created_at?: string
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          influencer_id?: string
          landing_page_first_visit_at?: string | null
          landing_page_slug?: string | null
          landing_page_visits?: number | null
          selected_clip_ids?: string[] | null
          shared_at?: string | null
          source_clips?: Json | null
          status?: string
          total_render_cost_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_packages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_packages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_packages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
      }
      distribution_captions: {
        Row: {
          clip_id: string
          created_at: string | null
          id: string
          model: string
          platforms: string[]
          tokens_used: number | null
          user_id: string
          variants: Json
        }
        Insert: {
          clip_id: string
          created_at?: string | null
          id?: string
          model?: string
          platforms: string[]
          tokens_used?: number | null
          user_id: string
          variants: Json
        }
        Update: {
          clip_id?: string
          created_at?: string | null
          id?: string
          model?: string
          platforms?: string[]
          tokens_used?: number | null
          user_id?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "distribution_captions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      domains: {
        Row: {
          cost_yearly_usd: number | null
          created_at: string
          dkim_configured: boolean | null
          dmarc_configured: boolean | null
          domain: string
          expires_at: string | null
          id: string
          notes: string | null
          purchased_at: string | null
          redirect_to: string | null
          registrar: string | null
          spf_configured: boolean | null
          status: string | null
          warmup_started_at: string | null
        }
        Insert: {
          cost_yearly_usd?: number | null
          created_at?: string
          dkim_configured?: boolean | null
          dmarc_configured?: boolean | null
          domain: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          purchased_at?: string | null
          redirect_to?: string | null
          registrar?: string | null
          spf_configured?: boolean | null
          status?: string | null
          warmup_started_at?: string | null
        }
        Update: {
          cost_yearly_usd?: number | null
          created_at?: string
          dkim_configured?: boolean | null
          dmarc_configured?: boolean | null
          domain?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          purchased_at?: string | null
          redirect_to?: string | null
          registrar?: string | null
          spf_configured?: boolean | null
          status?: string | null
          warmup_started_at?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          ab_variants: Json | null
          actual_start_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instantly_campaign_id: string | null
          name: string
          scheduled_start_at: string | null
          sequence_steps: Json
          status: string
          target_segment: Json | null
          total_bounced: number | null
          total_converted: number | null
          total_opened: number | null
          total_recipients: number | null
          total_replied: number | null
          total_sent: number | null
          total_unsubscribed: number | null
          updated_at: string
        }
        Insert: {
          ab_variants?: Json | null
          actual_start_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instantly_campaign_id?: string | null
          name: string
          scheduled_start_at?: string | null
          sequence_steps?: Json
          status?: string
          target_segment?: Json | null
          total_bounced?: number | null
          total_converted?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string
        }
        Update: {
          ab_variants?: Json | null
          actual_start_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instantly_campaign_id?: string | null
          name?: string
          scheduled_start_at?: string | null
          sequence_steps?: Json
          status?: string
          target_segment?: Json | null
          total_bounced?: number | null
          total_converted?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_replied?: number | null
          total_sent?: number | null
          total_unsubscribed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          campaign_id: string | null
          event_type: string
          id: string
          influencer_id: string | null
          message_id: string | null
          metadata: Json | null
          occurred_at: string
          webhook_event_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          event_type: string
          id?: string
          influencer_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          webhook_event_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          event_type?: string
          id?: string
          influencer_id?: string | null
          message_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
          {
            foreignKeyName: "email_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_email_messages_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          ai_classified_at: string | null
          ai_confidence: number | null
          ai_intent: string | null
          ai_sentiment: string | null
          body_html: string | null
          body_text: string | null
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          campaign_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          id: string
          in_reply_to_message_id: string | null
          influencer_id: string | null
          is_archived: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          mailbox_id: string | null
          message_id_external: string | null
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          subject: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          ai_classified_at?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          ai_sentiment?: string | null
          body_html?: string | null
          body_text?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          id?: string
          in_reply_to_message_id?: string | null
          influencer_id?: string | null
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          mailbox_id?: string | null
          message_id_external?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_classified_at?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          ai_sentiment?: string | null
          body_html?: string | null
          body_text?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          in_reply_to_message_id?: string | null
          influencer_id?: string | null
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          mailbox_id?: string | null
          message_id_external?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_in_reply_to_message_id_fkey"
            columns: ["in_reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_in_reply_to_message_id_fkey"
            columns: ["in_reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "v_email_messages_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          avg_open_rate: number | null
          avg_reply_rate: number | null
          body_html: string | null
          body_text: string
          category: string | null
          created_at: string
          id: string
          name: string
          parent_template_id: string | null
          subject: string
          times_used: number | null
          updated_at: string
          variables: Json | null
          version: number | null
        }
        Insert: {
          avg_open_rate?: number | null
          avg_reply_rate?: number | null
          body_html?: string | null
          body_text: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
          parent_template_id?: string | null
          subject: string
          times_used?: number | null
          updated_at?: string
          variables?: Json | null
          version?: number | null
        }
        Update: {
          avg_open_rate?: number | null
          avg_reply_rate?: number | null
          body_html?: string | null
          body_text?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_template_id?: string | null
          subject?: string
          times_used?: number | null
          updated_at?: string
          variables?: Json | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          influencer_id: string | null
          referral_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          influencer_id?: string | null
          referral_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          influencer_id?: string | null
          referral_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
          {
            foreignKeyName: "fraud_flags_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          campaign_id: string | null
          event_metadata: Json | null
          event_type: string
          id: string
          influencer_id: string | null
          message_id: string | null
          occurred_at: string
          source: string | null
          source_metadata: Json | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          event_metadata?: Json | null
          event_type: string
          id?: string
          influencer_id?: string | null
          message_id?: string | null
          occurred_at?: string
          source?: string | null
          source_metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          event_metadata?: Json | null
          event_type?: string
          id?: string
          influencer_id?: string | null
          message_id?: string | null
          occurred_at?: string
          source?: string | null
          source_metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
          {
            foreignKeyName: "funnel_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_email_messages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          completed_at: string | null
          errors: Json | null
          file_name: string | null
          id: string
          imported_by: string
          metadata: Json | null
          rows_failed: number
          rows_imported: number
          rows_skipped_duplicate: number
          rows_skipped_suppression: number
          rows_total: number
          source: string
          started_at: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          errors?: Json | null
          file_name?: string | null
          id?: string
          imported_by: string
          metadata?: Json | null
          rows_failed?: number
          rows_imported?: number
          rows_skipped_duplicate?: number
          rows_skipped_suppression?: number
          rows_total?: number
          source: string
          started_at?: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          errors?: Json | null
          file_name?: string | null
          id?: string
          imported_by?: string
          metadata?: Json | null
          rows_failed?: number
          rows_imported?: number
          rows_skipped_duplicate?: number
          rows_skipped_suppression?: number
          rows_total?: number
          source?: string
          started_at?: string
          status?: string | null
        }
        Relationships: []
      }
      influencers: {
        Row: {
          affiliate_code: string | null
          audience_size: number | null
          country: string | null
          created_at: string
          data_retention_until: string | null
          display_name: string | null
          email: string
          email_verified: boolean | null
          estimated_value_usd: number | null
          first_name: string | null
          gdpr_consent: boolean | null
          id: string
          import_batch_id: string | null
          language: string | null
          last_active_at: string | null
          last_contacted_at: string | null
          last_name: string | null
          lead_score: number | null
          lead_score_reasons: Json | null
          niche: string | null
          notes: string | null
          platform_handle: string | null
          platform_url: string | null
          primary_platform: string | null
          source: string | null
          status: string
          status_changed_at: string | null
          stripe_connect_account_id: string | null
          stripe_connect_status: string | null
          tags: string[] | null
          timezone: string | null
          total_commission_earned_cents: number | null
          total_commission_paid_cents: number | null
          total_emails_opened: number | null
          total_emails_replied: number | null
          total_emails_sent: number | null
          total_paying_referrals: number | null
          total_referrals: number | null
          unsubscribed: boolean | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          affiliate_code?: string | null
          audience_size?: number | null
          country?: string | null
          created_at?: string
          data_retention_until?: string | null
          display_name?: string | null
          email: string
          email_verified?: boolean | null
          estimated_value_usd?: number | null
          first_name?: string | null
          gdpr_consent?: boolean | null
          id?: string
          import_batch_id?: string | null
          language?: string | null
          last_active_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          lead_score?: number | null
          lead_score_reasons?: Json | null
          niche?: string | null
          notes?: string | null
          platform_handle?: string | null
          platform_url?: string | null
          primary_platform?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string | null
          tags?: string[] | null
          timezone?: string | null
          total_commission_earned_cents?: number | null
          total_commission_paid_cents?: number | null
          total_emails_opened?: number | null
          total_emails_replied?: number | null
          total_emails_sent?: number | null
          total_paying_referrals?: number | null
          total_referrals?: number | null
          unsubscribed?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_code?: string | null
          audience_size?: number | null
          country?: string | null
          created_at?: string
          data_retention_until?: string | null
          display_name?: string | null
          email?: string
          email_verified?: boolean | null
          estimated_value_usd?: number | null
          first_name?: string | null
          gdpr_consent?: boolean | null
          id?: string
          import_batch_id?: string | null
          language?: string | null
          last_active_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          lead_score?: number | null
          lead_score_reasons?: Json | null
          niche?: string | null
          notes?: string | null
          platform_handle?: string | null
          platform_url?: string | null
          primary_platform?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string | null
          tags?: string[] | null
          timezone?: string | null
          total_commission_earned_cents?: number | null
          total_commission_paid_cents?: number | null
          total_emails_opened?: number | null
          total_emails_replied?: number | null
          total_emails_sent?: number | null
          total_paying_referrals?: number | null
          total_referrals?: number | null
          unsubscribed?: boolean | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_enrichment_snapshots: {
        Row: {
          audience_size: number | null
          cost_cents: number | null
          engagement_rate: number | null
          fetched_at: string
          id: string
          influencer_id: string
          last_post_at: string | null
          niche_detected: string | null
          provider: string
          raw_data: Json
          recent_posts_count: number | null
        }
        Insert: {
          audience_size?: number | null
          cost_cents?: number | null
          engagement_rate?: number | null
          fetched_at?: string
          id?: string
          influencer_id: string
          last_post_at?: string | null
          niche_detected?: string | null
          provider: string
          raw_data: Json
          recent_posts_count?: number | null
        }
        Update: {
          audience_size?: number | null
          cost_cents?: number | null
          engagement_rate?: number | null
          fetched_at?: string
          id?: string
          influencer_id?: string
          last_post_at?: string | null
          niche_detected?: string | null
          provider?: string
          raw_data?: Json
          recent_posts_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_enrichment_snapshots_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_enrichment_snapshots_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_enrichment_snapshots_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
      }
      mailbox_daily_stats: {
        Row: {
          created_at: string
          emails_bounced: number | null
          emails_complained: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          emails_unsubscribed: number | null
          id: string
          mailbox_id: string
          reputation_score: number | null
          stat_date: string
          warmup_emails: number | null
        }
        Insert: {
          created_at?: string
          emails_bounced?: number | null
          emails_complained?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          emails_unsubscribed?: number | null
          id?: string
          mailbox_id: string
          reputation_score?: number | null
          stat_date: string
          warmup_emails?: number | null
        }
        Update: {
          created_at?: string
          emails_bounced?: number | null
          emails_complained?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          emails_unsubscribed?: number | null
          id?: string
          mailbox_id?: string
          reputation_score?: number | null
          stat_date?: string
          warmup_emails?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_daily_stats_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailbox_daily_stats_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "v_mailboxes_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          bounce_rate_pct: number | null
          complaint_rate_pct: number | null
          created_at: string
          credentials_encrypted: string | null
          daily_send_limit: number | null
          display_name: string | null
          dkim_valid: boolean | null
          dmarc_valid: boolean | null
          domain: string
          email: string
          emails_sent_today: number | null
          id: string
          imap_host: string | null
          instantly_account_id: string | null
          last_dns_check_at: string | null
          last_health_check_at: string | null
          provider: string | null
          reputation_score: number | null
          retired_at: string | null
          smtp_host: string | null
          smtp_port: number | null
          spf_valid: boolean | null
          status: string
          total_emails_sent: number | null
          updated_at: string
        }
        Insert: {
          bounce_rate_pct?: number | null
          complaint_rate_pct?: number | null
          created_at?: string
          credentials_encrypted?: string | null
          daily_send_limit?: number | null
          display_name?: string | null
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain: string
          email: string
          emails_sent_today?: number | null
          id?: string
          imap_host?: string | null
          instantly_account_id?: string | null
          last_dns_check_at?: string | null
          last_health_check_at?: string | null
          provider?: string | null
          reputation_score?: number | null
          retired_at?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          spf_valid?: boolean | null
          status?: string
          total_emails_sent?: number | null
          updated_at?: string
        }
        Update: {
          bounce_rate_pct?: number | null
          complaint_rate_pct?: number | null
          created_at?: string
          credentials_encrypted?: string | null
          daily_send_limit?: number | null
          display_name?: string | null
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain?: string
          email?: string
          emails_sent_today?: number | null
          id?: string
          imap_host?: string | null
          instantly_account_id?: string | null
          last_dns_check_at?: string | null
          last_health_check_at?: string | null
          provider?: string | null
          reputation_score?: number | null
          retired_at?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          spf_valid?: boolean | null
          status?: string
          total_emails_sent?: number | null
          updated_at?: string
        }
        Relationships: []
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
      payout_holds: {
        Row: {
          created_at: string
          held_until: string
          hold_reason: string
          id: string
          ledger_entry_id: string
          released_at: string | null
        }
        Insert: {
          created_at?: string
          held_until: string
          hold_reason: string
          id?: string
          ledger_entry_id: string
          released_at?: string | null
        }
        Update: {
          created_at?: string
          held_until?: string
          hold_reason?: string
          id?: string
          ledger_entry_id?: string
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_holds_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "affiliate_commission_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      product_activation_events: {
        Row: {
          event_name: string
          id: string
          metadata: Json | null
          occurred_at: string
          referred_by_influencer_id: string | null
          user_id: string
        }
        Insert: {
          event_name: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          referred_by_influencer_id?: string | null
          user_id: string
        }
        Update: {
          event_name?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          referred_by_influencer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_activation_events_referred_by_influencer_id_fkey"
            columns: ["referred_by_influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_activation_events_referred_by_influencer_id_fkey"
            columns: ["referred_by_influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_activation_events_referred_by_influencer_id_fkey"
            columns: ["referred_by_influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
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
          referred_by_influencer_id: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          usage_reset_month: number | null
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
          referred_by_influencer_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          usage_reset_month?: number | null
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
          referred_by_influencer_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          usage_reset_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_influencer_id_fkey"
            columns: ["referred_by_influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_influencer_id_fkey"
            columns: ["referred_by_influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_influencer_id_fkey"
            columns: ["referred_by_influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
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
      published_posts: {
        Row: {
          account_handle: string | null
          account_id: string | null
          algo_score_at_pick: number | null
          blowup_chance_at_render: number | null
          caption_style: string | null
          caption_tone: string | null
          clip_id: string
          clip_mood: string | null
          comments: number | null
          created_at: string
          duration_seconds: number | null
          hook_enabled: boolean | null
          hook_style: string | null
          id: string
          likes: number | null
          niche: string | null
          platform: string
          platform_post_id: string | null
          posted_hour_local: number | null
          posted_weekday: number | null
          published_at: string
          render_job_id: string | null
          retention_rate: number | null
          saves: number | null
          shares: number | null
          smart_zoom_mode: string | null
          source_platform: string | null
          source_streamer: string | null
          split_screen_enabled: boolean | null
          updated_at: string
          user_id: string
          views: number | null
          watch_time_avg: number | null
        }
        Insert: {
          account_handle?: string | null
          account_id?: string | null
          algo_score_at_pick?: number | null
          blowup_chance_at_render?: number | null
          caption_style?: string | null
          caption_tone?: string | null
          clip_id: string
          clip_mood?: string | null
          comments?: number | null
          created_at?: string
          duration_seconds?: number | null
          hook_enabled?: boolean | null
          hook_style?: string | null
          id?: string
          likes?: number | null
          niche?: string | null
          platform: string
          platform_post_id?: string | null
          posted_hour_local?: number | null
          posted_weekday?: number | null
          published_at?: string
          render_job_id?: string | null
          retention_rate?: number | null
          saves?: number | null
          shares?: number | null
          smart_zoom_mode?: string | null
          source_platform?: string | null
          source_streamer?: string | null
          split_screen_enabled?: boolean | null
          updated_at?: string
          user_id: string
          views?: number | null
          watch_time_avg?: number | null
        }
        Update: {
          account_handle?: string | null
          account_id?: string | null
          algo_score_at_pick?: number | null
          blowup_chance_at_render?: number | null
          caption_style?: string | null
          caption_tone?: string | null
          clip_id?: string
          clip_mood?: string | null
          comments?: number | null
          created_at?: string
          duration_seconds?: number | null
          hook_enabled?: boolean | null
          hook_style?: string | null
          id?: string
          likes?: number | null
          niche?: string | null
          platform?: string
          platform_post_id?: string | null
          posted_hour_local?: number | null
          posted_weekday?: number | null
          published_at?: string
          render_job_id?: string | null
          retention_rate?: number | null
          saves?: number | null
          shares?: number | null
          smart_zoom_mode?: string | null
          source_platform?: string | null
          source_streamer?: string | null
          split_screen_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          views?: number | null
          watch_time_avg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "published_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_posts_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      suppression_list: {
        Row: {
          added_at: string
          added_by: string | null
          email: string | null
          email_domain: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          reason: string
          source: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email?: string | null
          email_domain?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          reason: string
          source?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string | null
          email_domain?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          reason?: string
          source?: string | null
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
      unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          source_campaign_id: string | null
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          source_campaign_id?: string | null
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          source_campaign_id?: string | null
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribe_tokens_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
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
      webhook_events: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          payload_hash: string
          processed_at: string | null
          processing_status: string | null
          provider: string
          received_at: string
          retry_count: number | null
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          payload_hash: string
          processed_at?: string | null
          processing_status?: string | null
          provider: string
          received_at?: string
          retry_count?: number | null
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string
          processed_at?: string | null
          processing_status?: string | null
          provider?: string
          received_at?: string
          retry_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      v_active_affiliates_leaderboard: {
        Row: {
          affiliate_code: string | null
          display_name: string | null
          email: string | null
          id: string | null
          last_active_at: string | null
          new_paying_this_month: number | null
          new_referrals_this_month: number | null
          pending_commission_cents: number | null
          total_commission_earned_cents: number | null
          total_commission_paid_cents: number | null
          total_paying_referrals: number | null
          total_referrals: number | null
        }
        Relationships: []
      }
      v_affiliate_activation_stats: {
        Row: {
          activated_users: number | null
          activation_rate_pct: number | null
          display_name: string | null
          influencer_id: string | null
          paying_users: number | null
          signups: number | null
        }
        Relationships: []
      }
      v_affiliate_balances: {
        Row: {
          available_balance_cents: number | null
          clawback_cents: number | null
          earned_cents: number | null
          influencer_id: string | null
          paid_out_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_ledger_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_ledger_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
      }
      v_daily_funnel_metrics: {
        Row: {
          day: string | null
          event_count: number | null
          event_type: string | null
          unique_influencers: number | null
        }
        Relationships: []
      }
      v_email_messages_safe: {
        Row: {
          ai_classified_at: string | null
          ai_confidence: number | null
          ai_intent: string | null
          ai_sentiment: string | null
          body_html: string | null
          body_text: string | null
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          campaign_id: string | null
          created_at: string | null
          delivered_at: string | null
          direction: string | null
          id: string | null
          influencer_id: string | null
          is_archived: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          mailbox_id: string | null
          message_id_external: string | null
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          subject: string | null
          thread_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_classified_at?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          ai_sentiment?: string | null
          body_html?: never
          body_text?: never
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string | null
          id?: string | null
          influencer_id?: string | null
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          mailbox_id?: string | null
          message_id_external?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_classified_at?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          ai_sentiment?: string | null
          body_html?: never
          body_text?: never
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string | null
          id?: string | null
          influencer_id?: string | null
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          mailbox_id?: string | null
          message_id_external?: string | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          thread_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_active_affiliates_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "v_affiliate_activation_stats"
            referencedColumns: ["influencer_id"]
          },
        ]
      }
      v_influencer_funnel_stats: {
        Row: {
          avg_lead_score: number | null
          count: number | null
          new_this_month: number | null
          new_this_week: number | null
          status: string | null
        }
        Relationships: []
      }
      v_mailboxes_safe: {
        Row: {
          bounce_rate_pct: number | null
          complaint_rate_pct: number | null
          created_at: string | null
          credentials_encrypted: string | null
          daily_send_limit: number | null
          display_name: string | null
          dkim_valid: boolean | null
          dmarc_valid: boolean | null
          domain: string | null
          email: string | null
          emails_sent_today: number | null
          id: string | null
          provider: string | null
          reputation_score: number | null
          spf_valid: boolean | null
          status: string | null
          total_emails_sent: number | null
        }
        Insert: {
          bounce_rate_pct?: number | null
          complaint_rate_pct?: number | null
          created_at?: string | null
          credentials_encrypted?: never
          daily_send_limit?: number | null
          display_name?: string | null
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain?: string | null
          email?: string | null
          emails_sent_today?: number | null
          id?: string | null
          provider?: string | null
          reputation_score?: number | null
          spf_valid?: boolean | null
          status?: string | null
          total_emails_sent?: number | null
        }
        Update: {
          bounce_rate_pct?: number | null
          complaint_rate_pct?: number | null
          created_at?: string | null
          credentials_encrypted?: never
          daily_send_limit?: number | null
          display_name?: string | null
          dkim_valid?: boolean | null
          dmarc_valid?: boolean | null
          domain?: string | null
          email?: string | null
          emails_sent_today?: number | null
          id?: string | null
          provider?: string | null
          reputation_score?: number | null
          spf_valid?: boolean | null
          status?: string | null
          total_emails_sent?: number | null
        }
        Relationships: []
      }
      v_payout_summary_current_month: {
        Row: {
          failed_count: number | null
          on_hold_count: number | null
          pending_count: number | null
          sent_count: number | null
          total_adjustments_cents: number | null
          total_gross_cents: number | null
          total_net_cents: number | null
          unique_affiliates: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_influencer_tag: {
        Args: { p_influencer_id: string; p_tag: string }
        Returns: undefined
      }
      add_to_suppression: {
        Args: { p_email: string; p_notes?: string; p_reason: string }
        Returns: string
      }
      auth_role: { Args: never; Returns: string }
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
      can_manage_campaigns: { Args: never; Returns: boolean }
      can_manage_crm: { Args: never; Returns: boolean }
      can_manage_payouts: { Args: never; Returns: boolean }
      can_view_credentials: { Args: never; Returns: boolean }
      can_view_crm: { Args: never; Returns: boolean }
      can_view_finance: { Args: never; Returns: boolean }
      can_view_inbox: { Args: never; Returns: boolean }
      can_view_inbox_bodies: { Args: never; Returns: boolean }
      check_rate_limit: {
        Args: { p_identifier: string; p_limit: number; p_window_ms: number }
        Returns: boolean
      }
      cleanup_old_affiliate_clicks: { Args: never; Returns: undefined }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      create_manual_ledger_adjustment: {
        Args: {
          p_amount_cents: number
          p_influencer_id: string
          p_reason: string
        }
        Returns: string
      }
      decrement_video_usage: { Args: { p_user_id: string }; Returns: boolean }
      generate_referral_code: { Args: never; Returns: string }
      get_suppression_stats: { Args: never; Returns: Json }
      increment_export_count: {
        Args: { p_clip_id: string }
        Returns: undefined
      }
      increment_video_usage: {
        Args: { p_max_videos: number; p_user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_any: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_suppressed: { Args: { p_email: string }; Returns: boolean }
      on_user_payment: {
        Args: { p_amount_cents: number; p_user_id: string }
        Returns: undefined
      }
      remove_influencer_tag: {
        Args: { p_influencer_id: string; p_tag: string }
        Returns: undefined
      }
      try_consume_video_credit: {
        Args: { p_max_videos: number; p_user_id: string }
        Returns: boolean
      }
      update_influencer_notes: {
        Args: { p_influencer_id: string; p_notes: string }
        Returns: undefined
      }
      update_influencer_status: {
        Args: { p_influencer_id: string; p_new_status: string }
        Returns: undefined
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
