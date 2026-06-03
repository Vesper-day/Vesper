-- Migration 2 — users
-- Block 1 foundation, suffix 2 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 1 (users) + §4 (New User Trigger).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- Table ----------------------------------------------------------------------
-- id shares its primary key with auth.users and cascades on auth deletion; the
-- entire account-deletion architecture (§3 Soft-Delete, §4 Phase 3) depends on
-- this FK + ON DELETE CASCADE. Rows are never created with a generated default;
-- handle_new_user() supplies id = auth.users.id.
CREATE TABLE public.users (
  id                     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  text NOT NULL UNIQUE,
  archetype              archetype_enum NOT NULL,
  timezone               text NOT NULL DEFAULT 'America/Los_Angeles',
  location_lat           numeric(10,7),
  location_lng           numeric(10,7),
  honorific              honorific_enum NOT NULL DEFAULT 'none',
  subscription_status    subscription_status_enum NOT NULL DEFAULT 'trial',
  trial_started_at       timestamptz,
  trial_ends_at          timestamptz,
  deletion_requested_at  timestamptz,
  tier                   tier_enum NOT NULL DEFAULT 'standard',
  payment_source         payment_source_enum,
  referred_by_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- six-character base62 slug; minted by the trial->active webhook handler
  -- (chat 081), NULL until then. Stored as text UNIQUE per §3.
  referral_code          text UNIQUE,
  onboarding_completed_at timestamptz,
  last_warmed_at         timestamptz,
  biometric_lock_enabled boolean NOT NULL DEFAULT false,
  -- local time-of-day (HH:MM, no date); time not timestamptz so DST transitions
  -- do not shift the stored target. Absolute instant computed at read time
  -- from this column + users.timezone.
  sleep_target_bedtime   time,
  sleep_target_wake      time,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Indexes (§3 table 1) -------------------------------------------------------
CREATE INDEX idx_users_subscription_status
  ON public.users (subscription_status);

CREATE INDEX idx_users_trial_ends_at
  ON public.users (trial_ends_at)
  WHERE subscription_status = 'trial';

CREATE INDEX idx_users_deletion_requested_at
  ON public.users (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

CREATE INDEX idx_users_referred_by_user_id
  ON public.users (referred_by_user_id)
  WHERE referred_by_user_id IS NOT NULL;

-- Row Level Security ---------------------------------------------------------
-- Deny-all default (§3 RLS Default Posture). Own-row SELECT and UPDATE only.
-- No INSERT policy: rows are created exclusively by handle_new_user().
-- No DELETE policy: hard delete runs via the service role only.
-- Column-level write restriction (subscription_status, trial_ends_at,
-- payment_source, deletion_requested_at) is enforced at the application layer
-- per §3 — Postgres RLS is row-level, not column-level.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- New-user trigger (§4) ------------------------------------------------------
-- SECURITY DEFINER so the trigger can write public.users while running in the
-- auth.users insert context. search_path pinned to public to prevent search
-- path injection. Sets the NOT NULL archetype (default 'mixed', updated during
-- onboarding) and the trial window; timezone/honorific/subscription_status/
-- tier take their column defaults. user_profiles insert is added in migration 3.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, archetype, trial_started_at, trial_ends_at)
  VALUES (NEW.id, NEW.email, 'mixed', now(), now() + interval '7 days');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
