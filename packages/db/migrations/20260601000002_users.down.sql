-- Down — Migration 2 (users)
-- Reverses 20260601000002_users.sql. Local-dev / supabase db reset only.
-- Drop trigger before its function; drop table last.

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Policies drop with the table, but listed for explicitness.
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_select_own ON public.users;

DROP TABLE IF EXISTS public.users;

COMMIT;
