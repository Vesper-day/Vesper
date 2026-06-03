-- Migration 7 — integrations (integrations, push_tokens)
-- Block 1 foundation, suffix 7 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 tables 12-13 (Migration Sequence step 7).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- integrations (§3 table 12) -------------------------------------------------
-- OAuth connections to third-party providers. Tokens stored as bytea; pgsodium
-- encryption is wired in application code (chat 063), NOT in this migration.
-- Audit trigger attached in migration 11.
CREATE TABLE public.integrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider                integration_provider_enum NOT NULL,
  status                  integration_status_enum NOT NULL DEFAULT 'connected',
  access_token_encrypted  bytea NOT NULL,
  refresh_token_encrypted bytea,
  expires_at              timestamptz,
  last_synced_at          timestamptz,
  last_error              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- The UNIQUE (user_id, provider) btree is the primary access path.
-- Diagnostic queries ("all Google Calendar integrations in error state").
CREATE INDEX idx_integrations_provider_status
  ON public.integrations (provider, status);

-- push_tokens (§3 table 13) --------------------------------------------------
-- APNs/FCM device tokens plus iOS Live Activity push tokens. One row per
-- (user_id, device_id); a device may rotate its token in place.
CREATE TABLE public.push_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform            push_platform_enum NOT NULL,
  token               text NOT NULL,
  live_activity_token text,
  device_id           text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_used_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

-- Partial index for the Live Activity Push Start cron worker (§3 table 13).
CREATE INDEX idx_push_tokens_live_activity_token
  ON public.push_tokens (live_activity_token)
  WHERE live_activity_token IS NOT NULL;

-- Row Level Security ---------------------------------------------------------
-- Standard own-row pattern on both (§3 Conventions). Token decryption happens
-- through service-role queries; clients never see encrypted bytes.
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens  ENABLE ROW LEVEL SECURITY;

-- integrations
CREATE POLICY integrations_select_own ON public.integrations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY integrations_insert_own ON public.integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY integrations_update_own ON public.integrations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY integrations_delete_own ON public.integrations
  FOR DELETE USING (auth.uid() = user_id);

-- push_tokens
CREATE POLICY push_tokens_select_own ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY push_tokens_insert_own ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY push_tokens_update_own ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY push_tokens_delete_own ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
