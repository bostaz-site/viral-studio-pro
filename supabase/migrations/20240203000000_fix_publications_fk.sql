-- Fix publications.social_account_id FK to SET NULL on delete
-- (prevents FK violation when a social account is disconnected)
ALTER TABLE public.publications
    DROP CONSTRAINT IF EXISTS publications_social_account_id_fkey;

ALTER TABLE public.publications
    ADD CONSTRAINT publications_social_account_id_fkey
    FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id)
    ON DELETE SET NULL;
