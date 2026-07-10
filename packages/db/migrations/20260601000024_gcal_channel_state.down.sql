-- Down migration 24 — gcal_channel_state
-- Local-dev reset only (docs/MIGRATION_DISCIPLINE.md — .down.sql is never run in
-- staging/production; forward-only there). Drops exactly what the .up added.
--
-- The .up added no enum value and no non-reversible object, so this DOWN is a clean
-- inverse: drop the partial index, then the three columns.

BEGIN;

DROP INDEX IF EXISTS public.idx_integrations_channel_id;

ALTER TABLE public.integrations
  DROP COLUMN IF EXISTS channel_expiration,
  DROP COLUMN IF EXISTS resource_id,
  DROP COLUMN IF EXISTS channel_id;

COMMIT;
