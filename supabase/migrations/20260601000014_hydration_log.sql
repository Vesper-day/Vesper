-- Migration 14 — hydration_log
-- Block 4-7 additions, suffix 14 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 21.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- hydration_log (§3 table 21) ------------------------------------------------
-- One row per hydration tap. The daily counter is derived by query against
-- start_of_local_day(tz); there is no stored daily total and no reset job.
-- Append-only: no UPDATE/DELETE policies. Does not affect base_profile_version.
CREATE TABLE public.hydration_log (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  count     integer NOT NULL DEFAULT 1 CHECK (count > 0)
);

-- For the daily counter query: COUNT(*) WHERE user_id = $1
--   AND logged_at >= start_of_local_day($2).
CREATE INDEX idx_hydration_log_user_id_logged_at
  ON public.hydration_log (user_id, logged_at DESC);

-- Row Level Security ---------------------------------------------------------
-- Own-row SELECT and INSERT; immutable (no UPDATE/DELETE) (§3 table 21).
ALTER TABLE public.hydration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY hydration_log_select_own ON public.hydration_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY hydration_log_insert_own ON public.hydration_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
