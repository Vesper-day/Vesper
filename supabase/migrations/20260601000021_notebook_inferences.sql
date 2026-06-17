-- Migration 21 — notebook_inferences (Butler's Notebook storage)
-- Block 4-7 additions, suffix 21 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Build-time allocation: highest committed in-block suffix is 0020
-- (chat111_schema_checkpoint); 0019 is occupied in supabase/migrations as
-- start_of_local_day (the 4a↔19 divergence). Next genuinely-free integer = 21.
-- Source: docs/PHASE_4_BUILD_PLAN.md "Chat 108"; no notebook_inferences table
-- exists in TECHNICAL_SPEC.md §3, so the column list is derived from the
-- build-plan prose + the chat-005 sensitive-table RLS pattern.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- Models a SINGLE current inference surfaced occasionally (LAYER_4 "Butler's
-- Notebook": at most a few times per week, no list accumulation, no insights
-- dashboard) — favours the confirm/correct lifecycle of one inference at a time
-- over an append-only feed. The confirm/correct copy + butler voice gate are
-- chat 108a's concern; this table only stores the inference text and records
-- the state transition.

BEGIN;

-- Confirm/correct lifecycle. Closed set → pgEnum (templates.ts convention).
CREATE TYPE notebook_inference_state_enum AS ENUM (
  'pending',
  'confirmed',
  'corrected'
);

-- notebook_inferences -------------------------------------------------------
-- Derived personal data: strict own-row RLS, audit posture per chat 005.
-- inference_text is authored in butler voice by the engine / chat 108a.
-- inference_type is a free-text source discriminator: no enumerated inference
-- taxonomy exists in any project artifact, so TEXT (not an enum) — if a closed
-- taxonomy lands later, migrate to a pgEnum then.
CREATE TABLE public.notebook_inferences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inference_text text NOT NULL,
  inference_type text NOT NULL,
  state          notebook_inference_state_enum NOT NULL DEFAULT 'pending',
  corrected_text text,
  surfaced_at    timestamptz,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Per-user most-recent read pattern.
CREATE INDEX idx_notebook_inferences_user_created
  ON public.notebook_inferences (user_id, created_at DESC);
-- The due/pending read path: most-recent pending row for a user.
CREATE INDEX idx_notebook_inferences_user_pending
  ON public.notebook_inferences (user_id)
  WHERE state = 'pending';

-- Row Level Security ---------------------------------------------------------
-- Strict own-row, deny-all default (no permissive policy). The Drizzle client
-- runs under the service role (BYPASSES RLS); these policies are
-- defense-in-depth for any non-service-role connection. SELECT covers the read
-- endpoint; UPDATE covers the only state-changing ops (confirm + correct).
-- INSERT/DELETE have no policy — engine inserts under the service role, and the
-- deny-all default forbids client INSERT/DELETE (mirrors cancellation_events).
ALTER TABLE public.notebook_inferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notebook_inferences_select_own ON public.notebook_inferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notebook_inferences_update_own ON public.notebook_inferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at maintained by the generic trigger from migration 13.
CREATE TRIGGER set_updated_at_notebook_inferences
  BEFORE UPDATE ON public.notebook_inferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
