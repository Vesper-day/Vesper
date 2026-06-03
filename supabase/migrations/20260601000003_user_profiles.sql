-- Migration 3 — user_profiles
-- Block 1 foundation, suffix 3 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 2 (user_profiles) + §4 (New User Trigger).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- Table ----------------------------------------------------------------------
-- Slow-changing per-user profile, split from users so base_profile_version can
-- drive prompt-cache invalidation without touching the identity row.
-- JSONB shapes (base_profile, modules_enabled) are validated at the API
-- boundary by Zod in @vesper/shared, not at the database level (§3 Conventions).
CREATE TABLE public.user_profiles (
  user_id              uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  base_profile         jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_profile_version integer NOT NULL DEFAULT 1,
  modules_enabled      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes: primary key on user_id is sufficient; all reads are single-user (§3).

-- Row Level Security ---------------------------------------------------------
-- Standard own-row pattern: SELECT / INSERT / UPDATE / DELETE keyed on
-- auth.uid() = user_id (§3 Conventions).
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_profiles_delete_own ON public.user_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Extend new-user trigger (§4) -----------------------------------------------
-- handle_new_user() now creates the matching user_profiles row in the same
-- transaction as the users row. Defaults populate base_profile ({}),
-- base_profile_version (1), and modules_enabled ({}).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, archetype, trial_started_at, trial_ends_at)
  VALUES (NEW.id, NEW.email, 'mixed', now(), now() + interval '7 days');

  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

COMMIT;
