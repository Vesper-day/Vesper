-- Migration 31 — subscription_webhook_columns (supabase mirror)
-- Up-only mirror of packages/db/migrations/20260601000031_subscription_webhook_columns.sql,
-- mirrored exactly as the 000024_gcal_channel_state migration is (supabase/ carries the
-- .up only; the canonical .up + .down live in packages/db/migrations/).
-- Blocks 8-11 additions, suffix 31 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: Chat 084 — Stripe webhook handler (workers/stripe-webhook).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN last_event_at          timestamptz,
  ADD COLUMN pending_trial_reminder boolean NOT NULL DEFAULT false;

COMMIT;
