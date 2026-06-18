-- Migration 22 — daily_plans.approved_at (CD-flag F1 resolution, chat 025)
-- Up-only Supabase mirror of packages/db/migrations/20260618000022_daily_plans_approved_at.sql
-- (dual-write convention per chats 048/108/111; config.toml has no migration_path
-- override, so supabase db push/reset reads this directory).
--
-- See the canonical migration for the full CD-flag F1 rationale: the evening
-- draft -> approve loop (LAYER_1/2/4) needs an approved-state column on
-- daily_plans. NULL = draft (generation leaves it NULL); chat 046-W sets it on
-- approval.

BEGIN;

ALTER TABLE public.daily_plans
  ADD COLUMN approved_at timestamptz;

COMMENT ON COLUMN public.daily_plans.approved_at IS
  'When the user approved this plan in the Vesper hour. NULL = draft, not yet '
  'approved (chat 046-W sets it). Generation leaves it NULL (CD-flag F1).';

COMMIT;
