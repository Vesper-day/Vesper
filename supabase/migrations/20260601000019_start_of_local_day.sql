-- Migration 4a — start_of_local_day(tz text)
-- Block 1 foundation, letter suffix 4a (sorts between 4 and 5;
-- docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 Migration Sequence step 13 (function body).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- Returns the timestamptz for the start of the current local day in the given
-- IANA timezone. Used by: trial regen cap (chat 025), hydration daily counter
-- (chat 050), trial reminder worker (chat 072), 3-regen prompt (chat 100).
-- LANGUAGE sql + STABLE + PARALLEL SAFE per §3 step 13.
CREATE OR REPLACE FUNCTION public.start_of_local_day(tz text)
RETURNS timestamptz
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz;
$$;

COMMIT;
