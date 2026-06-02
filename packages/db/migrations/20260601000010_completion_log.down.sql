-- Down migration 10 — completion_log
-- Reverses 20260601000010_completion_log.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.completion_log;

COMMIT;
