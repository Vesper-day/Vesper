-- Migration 17 — cancellation_events
-- Block 4-7 additions, suffix 17 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 24.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- cancellation_events (§3 table 24) ------------------------------------------
-- One row per cancellation: free-text reason + context snapshot for churn
-- cohort analysis. The structured reason enum lives on
-- subscriptions.cancellation_reason (source of truth). Written by the
-- cancellation API route under the service role. Immutable.
CREATE TABLE public.cancellation_events (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  free_text                   text,
  archetype                   archetype_enum,
  subscription_duration_days  integer,
  canceled_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cancellation_events_user_id
  ON public.cancellation_events (user_id);
-- For cohort analysis.
CREATE INDEX idx_cancellation_events_canceled_at
  ON public.cancellation_events (canceled_at DESC);

-- Row Level Security ---------------------------------------------------------
-- Own-row SELECT only; no INSERT from client (service-role only at cancellation
-- time); immutable, no UPDATE/DELETE (§3 table 24).
ALTER TABLE public.cancellation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cancellation_events_select_own ON public.cancellation_events
  FOR SELECT USING (auth.uid() = user_id);

COMMIT;
