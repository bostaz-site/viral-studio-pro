-- Extend mailboxes CHECK constraints to support DFY Google boxes (provider='google')
-- and Zoho reception-only boxes (status='reception_only').
-- Fixes: sync-mailboxes.ts rejected by old CHECKs since cold-email-v2 (S4).

ALTER TABLE public.mailboxes DROP CONSTRAINT mailboxes_provider_check;
ALTER TABLE public.mailboxes ADD CONSTRAINT mailboxes_provider_check
  CHECK (provider IN ('zoho', 'maildoso', 'gmail', 'google', 'outlook365', 'other'));

ALTER TABLE public.mailboxes DROP CONSTRAINT mailboxes_status_check;
ALTER TABLE public.mailboxes ADD CONSTRAINT mailboxes_status_check
  CHECK (status IN ('warming', 'active', 'paused', 'blocked', 'rate_limited', 'retired', 'reception_only'));
