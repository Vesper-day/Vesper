-- Down migration 7 — integrations
-- Reverses 20260601000007_integrations.sql. Local-dev reset only (not production).

BEGIN;

DROP TABLE IF EXISTS public.push_tokens;
DROP TABLE IF EXISTS public.integrations;

COMMIT;
