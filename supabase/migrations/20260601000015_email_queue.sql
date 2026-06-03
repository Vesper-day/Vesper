-- Migration 15 — email_queue
-- Block 4-7 additions, suffix 15 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 22.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- email_queue (§3 table 22) --------------------------------------------------
-- Deferred email sends. The daily-cron worker picks rows where
-- scheduled_for <= now() AND sent_at IS NULL, delivers via Resend, sets
-- sent_at. Idempotent on re-pickup. Service-role only (no public policies).
CREATE TABLE public.email_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at       timestamptz,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Partial index for the cron worker pickup query.
CREATE INDEX idx_email_queue_pending
  ON public.email_queue (scheduled_for)
  WHERE sent_at IS NULL;

-- Row Level Security ---------------------------------------------------------
-- RLS enabled with no policies → service-role only (§3 table 22).
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

COMMIT;
