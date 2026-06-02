-- Down migration 18 — calendar_events
-- Reverses 20260601000018_calendar_events.sql. Local-dev reset only.
-- Drop the trigger before the table; the shared set_updated_at() function is
-- owned by migration 13 and is not dropped here.

BEGIN;

DROP TRIGGER IF EXISTS set_updated_at_calendar_events ON public.calendar_events;
DROP TABLE IF EXISTS public.calendar_events;

COMMIT;
