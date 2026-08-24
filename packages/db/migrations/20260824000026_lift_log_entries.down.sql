-- Down migration 26 — lift_log_entries
-- Reverses 20260824000026_lift_log_entries.sql. Local-dev reset only.
-- DROP TABLE cascades the index, the set_updated_at trigger, the three CHECK
-- constraints, and the own-row RLS policies with the table.

BEGIN;

DROP TABLE IF EXISTS public.lift_log_entries;

COMMIT;
