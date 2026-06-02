-- Down — Migration 3 (user_profiles)
-- Reverses 20260601000003_user_profiles.sql. Local-dev / supabase db reset only.
-- Restore handle_new_user() to the migration-2 form (users insert only) BEFORE
-- dropping user_profiles, so the live function never references a dropped table.

BEGIN;

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

DROP POLICY IF EXISTS user_profiles_delete_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

DROP TABLE IF EXISTS public.user_profiles;

COMMIT;
