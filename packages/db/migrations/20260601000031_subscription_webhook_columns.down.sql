-- Down migration 31 — subscription_webhook_columns
-- Local-dev reset only (docs/MIGRATION_DISCIPLINE.md — .down.sql is never run in
-- staging/production; forward-only there). Drops exactly what the .up added.
--
-- The .up added no enum value and no non-reversible object, so this DOWN is a clean
-- inverse: drop the two columns.

BEGIN;

ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS pending_trial_reminder,
  DROP COLUMN IF EXISTS last_event_at;

COMMIT;
