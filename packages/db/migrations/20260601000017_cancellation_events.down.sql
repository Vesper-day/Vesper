-- Down migration 17 — cancellation_events
-- Reverses 20260601000017_cancellation_events.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.cancellation_events;

COMMIT;
