-- Bank = explicit autofarm queue (opt-in)
-- New render_jobs rows are created with removed_from_bank_at = now() (out-of-bank).
-- Only "Place in bank" action sets removed_from_bank_at = NULL (in-bank).
--
-- This migration sets the column DEFAULT so any future inserts that omit
-- removed_from_bank_at will default to the current timestamp (out-of-bank).
-- Existing rows are NOT touched — clips already in bank stay in bank.

ALTER TABLE public.render_jobs
  ALTER COLUMN removed_from_bank_at SET DEFAULT now();

-- NOTE: This does NOT backfill existing rows. Clips currently in bank
-- (removed_from_bank_at IS NULL) remain in bank. Only new renders will
-- default to out-of-bank.
