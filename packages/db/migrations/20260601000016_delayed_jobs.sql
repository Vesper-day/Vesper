-- Migration 16 — delayed_jobs
-- Block 4-7 additions, suffix 16 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 23.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- delayed_jobs (§3 table 23) -------------------------------------------------
-- Deferred job queue (replaces any third-party queue). The tick worker picks
-- rows where scheduled_for <= now() AND processed_at IS NULL, dispatches to the
-- job_type handler, sets processed_at. Idempotent on re-pickup. Service-role
-- only (no public policies).
CREATE TABLE public.delayed_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL,
  processed_at  timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Partial index for the tick worker pickup query.
CREATE INDEX idx_delayed_jobs_pending
  ON public.delayed_jobs (scheduled_for)
  WHERE processed_at IS NULL;

-- Row Level Security ---------------------------------------------------------
-- RLS enabled with no policies → service-role only (§3 table 23).
ALTER TABLE public.delayed_jobs ENABLE ROW LEVEL SECURITY;

COMMIT;
