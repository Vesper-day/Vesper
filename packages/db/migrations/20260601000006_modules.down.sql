-- Down migration 6 — modules
-- Reverses 20260601000006_modules.sql. Local-dev reset only (not production).

BEGIN;

DROP TABLE IF EXISTS public.bills;
DROP TABLE IF EXISTS public.recurring_errands;
DROP TABLE IF EXISTS public.medications;

COMMIT;
