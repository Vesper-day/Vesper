-- Migration 23 — auth-event trigger (auth.users UPDATE → internal auth-event)
-- Supabase-CLI mirror of packages/db/migrations/20260601000023_auth_event_trigger.sql
-- (up-only; the canonical pair with its .down.sql lives under packages/db).
-- Source: PHASE_4_BUILD_PLAN.md L1130. Hand-written per ARCHITECTURE_DECISIONS 01.
--
-- MECHANISM (not spec-specified; chosen + called out — see canonical migration):
--   * trigger→HTTP: pg_net (net.http_post), async.
--   * shared-secret + base URL: Supabase Vault (vault.decrypted_secrets), rows
--     `auth_event_secret` / `auth_event_base_url` provisioned out of band.
--   * fails open to a no-op when either Vault row is absent (db reset / unconfigured
--     envs are never blocked).

BEGIN;

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
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    v_event := 'password change';
  ELSE
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'auth_event_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_base_url
    FROM vault.decrypted_secrets WHERE name = 'auth_event_base_url' LIMIT 1;

  IF v_secret IS NULL OR v_base_url IS NULL THEN
    RETURN NEW;
  END IF;

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
