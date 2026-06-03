-- Migration 10 — completion_log
-- Block 1 foundation, suffix 10 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 18 (Migration Sequence step 10).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- completion_log (§3 table 18) -----------------------------------------------
-- Event log of plan interactions. `value` denormalizes block context at write
-- time so entries survive plan regeneration and block deletion; block_id is
-- ON DELETE SET NULL (not CASCADE) so log rows persist after the block is gone.
-- Append-only: no UPDATE/DELETE policies. Grows unbounded at V1
-- (docs/RETENTION_POLICY.md); V1.5 retention worker rolls up rows >90 days.
CREATE TABLE public.completion_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  block_id   uuid REFERENCES public.blocks(id) ON DELETE SET NULL,
  event_type completion_event_enum NOT NULL,
  value      jsonb NOT NULL,
  logged_at  timestamptz NOT NULL DEFAULT now()
);

-- Time-windowed queries (D7 retention, "blocks completed this week").
CREATE INDEX idx_completion_log_user_id_logged_at
  ON public.completion_log (user_id, logged_at DESC);
-- Event-type filtered queries.
CREATE INDEX idx_completion_log_user_id_event_type
  ON public.completion_log (user_id, event_type);
-- "Show me what happened with this block" (partial; block_id often NULL).
CREATE INDEX idx_completion_log_block_id
  ON public.completion_log (block_id)
  WHERE block_id IS NOT NULL;

-- Row Level Security ---------------------------------------------------------
-- Own-row SELECT and INSERT; no UPDATE/DELETE (immutable; deletion only via
-- user-cascade) (§3 table 18).
ALTER TABLE public.completion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY completion_log_select_own ON public.completion_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY completion_log_insert_own ON public.completion_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
