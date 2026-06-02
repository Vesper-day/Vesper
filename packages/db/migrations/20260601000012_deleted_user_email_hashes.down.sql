-- Down migration 12 — deleted_user_email_hashes
-- Reverses 20260601000012_deleted_user_email_hashes.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.deleted_user_email_hashes;

COMMIT;
