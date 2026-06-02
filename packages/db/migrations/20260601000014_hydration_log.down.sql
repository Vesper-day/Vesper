-- Down migration 14 — hydration_log
-- Reverses 20260601000014_hydration_log.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.hydration_log;

COMMIT;
