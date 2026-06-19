-- Migration 23 — auth-event trigger (auth.users UPDATE → internal auth-event)
-- Suffix 23: 0021 is the current max present; 0022 was deleted and is RETIRED,
-- never reused (docs/MIGRATION_NUMBER_ALLOCATION.md). Prefix 20260601 matches the
-- established Block-1 convention.
-- Source: PHASE_4_BUILD_PLAN.md L1130 (auth-event flow). Hand-written per
-- ARCHITECTURE_DECISIONS Decision 01.
--
-- WHAT THIS DOES
-- An AFTER UPDATE trigger on auth.users fires when Supabase Auth mutates a user
-- (the in-scope case for this chat: a PASSWORD CHANGE — encrypted_password
-- changes). The SECURITY DEFINER trigger function POSTs to the internal auth-event
-- endpoint, which deletes the user's push_tokens so stale devices stop receiving
-- pushes. Other event types (sign-out, session expired, hard-delete cascade) are
-- driven from the application via apps/web/lib/auth/onAuthStateChange.ts, which
-- hits the same endpoint.
--
-- ===========================================================================
-- MECHANISM CHOICE — REVIEW THIS (not specified by the spec; chat-030 kickoff
-- explicitly delegated the choice and required it be called out):
--   * trigger→HTTP transport: pg_net (`net.http_post`), the async HTTP client
--     Supabase ships. Chosen over Supabase "Database Webhooks" because those are
--     themselves pg_net wrappers configured out-of-band (not reproducible in a
--     migration), and over a synchronous extension to keep the auth write path
--     non-blocking.
--   * shared-secret storage: Supabase Vault (`vault.decrypted_secrets`). The
--     secret `auth_event_secret` and the base URL `auth_event_base_url` are read
--     at fire time. They are provisioned OUT OF BAND (operational step — e.g.
--     `select vault.create_secret('<secret>', 'auth_event_secret');`), NOT in this
--     migration, so no secret is committed to git.
-- The function FAILS OPEN to a NO-OP when either Vault row is absent (local dev /
-- unconfigured envs): it RETURNs without erroring, so `supabase db reset` and
-- normal auth writes are never blocked by missing config.
-- ===========================================================================

BEGIN;

-- pg_net (async HTTP from Postgres) + Vault (secret storage). Both ship with
-- Supabase; IF NOT EXISTS keeps this idempotent and safe on a fresh reset.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.handle_auth_user_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  v_secret    text;
  v_base_url  text;
  v_event     text;
BEGIN
  -- In scope this chat: a password change. Other UPDATEs are ignored so we do not
  -- spam the endpoint on unrelated auth.users mutations (last_sign_in_at, etc.).
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    v_event := 'password change';
  ELSE
    RETURN NEW;
  END IF;

  -- Read config from Vault. Absent ⇒ no-op (fail open) so unconfigured envs and
  -- `db reset` are never blocked.
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'auth_event_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_base_url
    FROM vault.decrypted_secrets WHERE name = 'auth_event_base_url' LIMIT 1;

  IF v_secret IS NULL OR v_base_url IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget POST (pg_net is async; it queues the request and returns).
  PERFORM net.http_post(
    url     := v_base_url || '/api/v1/internal/auth-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auth-event-secret', v_secret
    ),
    body    := jsonb_build_object(
      'userId', NEW.id::text,
      'eventType', v_event
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_event();

COMMIT;
