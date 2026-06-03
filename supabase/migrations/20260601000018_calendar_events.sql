-- Migration 18 — calendar_events
-- Block 4-7 additions, suffix 18 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 25.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- calendar_events (§3 table 25) ----------------------------------------------
-- User-created calendar events (distinct from Google Calendar events, which are
-- fetched at synthesis time and not stored). Participates in conflict detection
-- and plan synthesis.
CREATE TABLE public.calendar_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time   timestamptz NOT NULL CHECK (end_time > start_time),
  rrule      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- For synthesis-time range queries.
CREATE INDEX idx_calendar_events_user_id_start_time
  ON public.calendar_events (user_id, start_time);

-- updated_at trigger ---------------------------------------------------------
-- set_updated_at() is created in migration 13. calendar_events is created here
-- (after 13), so its trigger is attached now rather than in 13.
CREATE TRIGGER set_updated_at_calendar_events
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security ---------------------------------------------------------
-- Standard own-row pattern (§3 table 25).
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_events_select_own ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY calendar_events_insert_own ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY calendar_events_update_own ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY calendar_events_delete_own ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
