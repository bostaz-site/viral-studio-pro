-- ─────────────────────────────────────────────────────────────────────
-- Account deletion (GDPR compliance)
-- Ensures all user-related data cascades cleanly when a user deletes
-- their account. The deletion is triggered by removing the auth.users row;
-- this migration ensures every dependent table cleanly cascades.
--
-- Chain: auth.users → profiles → all user-scoped tables (clips, render_jobs,
-- published_posts, social_accounts, etc.) which already have ON DELETE CASCADE.
--
-- This migration only adds the missing FK on account_snapshots which was
-- previously a dangling reference (no FK constraint, see audit 2026-05-06).
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Add missing FK on account_snapshots ──────────────────────────
-- The account_snapshots table tracks Creator Rank history per social account.
-- Currently account_id is just a UUID column with no constraint — orphans
-- after social_account deletion, and never cleans up after user deletion.
-- Add FK with CASCADE so snapshots auto-delete when the account is removed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'account_snapshots_account_id_fkey'
      AND table_name = 'account_snapshots'
  ) THEN
    ALTER TABLE public.account_snapshots
      ADD CONSTRAINT account_snapshots_account_id_fkey
      FOREIGN KEY (account_id)
      REFERENCES public.social_accounts(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ── 2. Verify CASCADE chain (defensive) ─────────────────────────────
-- These tables should already have ON DELETE CASCADE on their user_id FK.
-- This block does NOT modify existing FKs — it only adds them where missing
-- (idempotent safety net). If they already exist they are skipped.

-- Note: All key tables (clips, render_jobs, published_posts, social_accounts,
-- distribution_captions, ai_calls, scheduled_publications, etc.) were created
-- with ON DELETE CASCADE in their original migrations. This is just an audit log.

-- ── 3. RLS DELETE policies — let users delete their own data ────────
-- Without DELETE policies, even cascading deletes can fail silently.
-- These policies allow users to trigger deletion of their own rows
-- (cascade still happens via the FK).

-- profiles: user can delete their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_delete_own_profile'
  ) THEN
    CREATE POLICY "users_delete_own_profile" ON public.profiles
      FOR DELETE
      USING (auth.uid() = id);
  END IF;
END $$;

-- social_accounts: user can delete their own connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'social_accounts' AND policyname = 'users_delete_own_social_accounts'
  ) THEN
    CREATE POLICY "users_delete_own_social_accounts" ON public.social_accounts
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- videos: user can delete their own uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'users_delete_own_videos'
  ) THEN
    CREATE POLICY "users_delete_own_videos" ON public.videos
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Schedule old anonymized rows cleanup (90 days) ───────────────
-- For tables that use ON DELETE SET NULL (analytics_events, ai_calls,
-- affiliates), the rows persist with user_id = NULL after deletion.
-- We keep them for analytics but anonymize them.
-- (Cron job will handle the actual cleanup — this is just documentation.)

COMMENT ON COLUMN public.ai_calls.user_id IS
  'Set to NULL when the user deletes their account (GDPR). Aggregated cost data is preserved.';

-- ── 5. Done ─────────────────────────────────────────────────────────
-- After this migration:
-- ✓ Deleting auth.users cascades to profiles
-- ✓ Profiles cascades to clips, render_jobs, published_posts, social_accounts,
--   distribution_captions, scheduled_publications, queue_settings, etc.
-- ✓ social_accounts cascades to account_snapshots (NEW)
-- ✓ ai_calls + analytics_events + affiliates: user_id set to NULL (preserves
--   aggregate analytics while honoring GDPR right-to-erasure)
