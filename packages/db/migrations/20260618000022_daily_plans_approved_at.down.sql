-- Down for Migration 22 — drop daily_plans.approved_at (CD-flag F1, chat 025).

BEGIN;

ALTER TABLE public.daily_plans
  DROP COLUMN IF EXISTS approved_at;

COMMIT;
