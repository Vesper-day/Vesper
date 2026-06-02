-- Down migration 15 — email_queue
-- Reverses 20260601000015_email_queue.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.email_queue;

COMMIT;
