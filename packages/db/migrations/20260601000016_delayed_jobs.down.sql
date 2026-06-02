-- Down migration 16 — delayed_jobs
-- Reverses 20260601000016_delayed_jobs.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.delayed_jobs;

COMMIT;
