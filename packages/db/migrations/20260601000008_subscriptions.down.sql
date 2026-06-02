-- Down migration 8 — subscriptions
-- Reverses 20260601000008_subscriptions.sql. Local-dev reset only (not production).

BEGIN;

DROP TABLE IF EXISTS public.subscription_events;
DROP TABLE IF EXISTS public.subscriptions;

COMMIT;
