-- Down — Migration 4a (start_of_local_day)
-- Reverses 20260601000004a_start_of_local_day.sql.
-- Local-dev / supabase db reset only.

BEGIN;

DROP FUNCTION IF EXISTS public.start_of_local_day(text);

COMMIT;
