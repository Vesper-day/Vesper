-- Migration 31 — subscription_webhook_columns
-- Blocks 8-11 additions, suffix 31 (docs/MIGRATION_NUMBER_ALLOCATION.md — 31 is the
--   lowest genuinely-free integer in the 31-50 range; highest existing schema suffix
--   is 24, so 25-30 are unused 14-30-range slots and 31 opens Blocks 8-11).
-- Source: Chat 084 — Stripe webhook handler (workers/stripe-webhook).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- WHAT THIS DOES: adds the two subscriptions columns the webhook handler needs that
-- migration 000008 (the canonical §3 table) did NOT carry:
--   last_event_at           the timestamp of the most-recently-APPLIED Stripe/Apple
--                            event. The handler's monotonic-ordering guard reads it and
--                            skips any delivery older than last_event_at - 24h (a stale
--                            out-of-order retry that would regress state), and advances
--                            it on every transition that proceeds. NULLABLE: a
--                            never-touched subscription has no applied event yet.
--   pending_trial_reminder  set true by the customer.subscription.trial_will_end
--                            handler (which does NOT transition state); the chat-072
--                            trial-reminder module reads it as a redundancy signal
--                            alongside its own date-based scheduling. NOT NULL DEFAULT
--                            false — a boolean redundancy flag has exactly two states
--                            (a pending reminder, or none); a nullable third state has
--                            no meaning in the 072 read contract. The table is empty
--                            pre-launch, so the default backfills nothing.
--
-- Additive, nullable-safe, no enum, no trigger — fully reversible (see .down.sql).

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN last_event_at          timestamptz,
  ADD COLUMN pending_trial_reminder boolean NOT NULL DEFAULT false;

COMMIT;
