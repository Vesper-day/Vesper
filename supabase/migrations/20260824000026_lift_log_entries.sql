-- Migration 26 — lift_log_entries (Chat ADD-C, Fitness module scaffold)
-- Block 4-7 additions, suffix 26 (docs/MIGRATION_NUMBER_ALLOCATION.md).
--   Used integer suffixes in the 14-30 block: 14,15,16,17,18,20,21,23,24,25
--   (19 skipped, 22 RETIRED) -> next free integer = 26. (ADD-B consumed 25.)
-- Source: PRD §6.2 (V1 fitness module surface, method B) + docs/MODULE_MOUNT_CONTRACT.md.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- Up-only supabase mirror of packages/db/migrations/20260824000026_lift_log_entries.sql
-- (the canonical pair). `supabase db push` applies this dir.
--
-- The lift-logging surface of the fitness module. One row per logged set. The "today"
-- read-back is derived by query against start_of_local_day(tz) (the same day-boundary
-- derivation the hydration counter uses, migration 14 / supabase mirror 000019). DEEP
-- fitness columns (bronze->platinum strength-rank; world-standard percentile mapping)
-- are DEFERRED (PRD §6.2) and intentionally NOT added here.

BEGIN;

CREATE TABLE public.lift_log_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  logged_at           timestamptz NOT NULL DEFAULT now(),
  exercise_name       text NOT NULL,
  workout_template_id uuid REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  set_number          integer NOT NULL CHECK (set_number > 0),
  reps                integer CHECK (reps IS NULL OR reps >= 0),
  weight              numeric(7, 2) CHECK (weight IS NULL OR weight >= 0),
  weight_unit         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lift_log_entries_user_id_logged_at
  ON public.lift_log_entries (user_id, logged_at);

CREATE TRIGGER set_updated_at_lift_log_entries
  BEFORE UPDATE ON public.lift_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lift_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY lift_log_entries_select_own ON public.lift_log_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY lift_log_entries_insert_own ON public.lift_log_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY lift_log_entries_update_own ON public.lift_log_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY lift_log_entries_delete_own ON public.lift_log_entries
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
