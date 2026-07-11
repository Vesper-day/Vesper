-- Migration 24 — gcal_channel_state
-- Block 4-7 additions, suffix 24 (docs/MIGRATION_NUMBER_ALLOCATION.md).
--   Suffix 22 is RETIRED (duplicate approved_at, see allocation doc); 23 is taken
--   (auth_event_trigger); 24 is the lowest genuinely-free integer in the 14–30 range.
-- Source: Chat 066 — Google Calendar push channel renewal + channel-state persistence.
--   Decision 19 (renew < 24h TTL) + Decision 20 (daily-cron gcal-channel-renewal module).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- WHAT THIS DOES: adds the push-channel state that Chat 065's registerWatch RETURNS
-- but had no column to persist (the "channel-state persistence gap" 065 handed to 066):
--   channel_id          the events.watch channel UUID (X-Goog-Channel-ID) — also the
--                        key the 065 receiver maps a push back to a user with.
--   resource_id         the opaque watched-resource id (X-Goog-Resource-ID).
--   channel_expiration  when Google will stop delivering on this channel (max 7 days);
--                        the renewal worker renews any row within 24h of this.
-- All three are NULLABLE: a not-yet-registered integration has no channel, and real
-- registration is Cutover-blocked (C-17), so every existing row is legitimately NULL
-- (add-nullable is the correct pre-launch shape — docs/MIGRATION_DISCIPLINE.md).
--
-- NO sync_token column: Chat 065 landed with NO persisted Google syncToken anywhere;
-- sync is a full re-fetch through getTodayEvents, not a delta. Nothing needs it.
--
-- NO completion_event_enum value: the renewal run is observed via a single structured
-- Sentry entry (sink option B), not a completion_log row — completion_log.user_id is
-- NOT NULL + FK so there is no valid aggregate/run-level row. This keeps the migration
-- to pure nullable column adds (fully reversible; no non-reversible ALTER TYPE).

BEGIN;

-- Channel-state columns (all nullable; add-only) -----------------------------
ALTER TABLE public.integrations
  ADD COLUMN channel_id         text,
  ADD COLUMN resource_id        text,
  ADD COLUMN channel_expiration timestamptz;

-- The 065 receiver resolves an incoming push to a user by channel_id on every
-- webhook, so channel_id needs its own index. Partial (only registered rows carry
-- a channel_id) keeps it small.
CREATE INDEX idx_integrations_channel_id
  ON public.integrations (channel_id)
  WHERE channel_id IS NOT NULL;

COMMIT;
