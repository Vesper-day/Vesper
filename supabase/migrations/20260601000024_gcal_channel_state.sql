-- Migration 24 — gcal_channel_state (supabase mirror)
-- Up-only mirror of packages/db/migrations/20260601000024_gcal_channel_state.sql,
-- mirrored exactly as the 000018_calendar_events migration is (supabase/ carries the
-- .up only; the canonical .up + .down live in packages/db/migrations/).
-- Block 4-7 additions, suffix 24 (docs/MIGRATION_NUMBER_ALLOCATION.md; 22 retired, 23 taken).
-- Source: Chat 066 — Google Calendar push channel renewal + channel-state persistence.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

ALTER TABLE public.integrations
  ADD COLUMN channel_id         text,
  ADD COLUMN resource_id        text,
  ADD COLUMN channel_expiration timestamptz;

CREATE INDEX idx_integrations_channel_id
  ON public.integrations (channel_id)
  WHERE channel_id IS NOT NULL;

COMMIT;
