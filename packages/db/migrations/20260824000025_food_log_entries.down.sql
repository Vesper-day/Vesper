-- Down migration 25 — food_log_entries
-- Reverses 20260824000025_food_log_entries.sql. Local-dev reset only.
-- DROP TABLE cascades the index, the set_updated_at trigger, and the own-row
-- RLS policies with the table.

BEGIN;

DROP TABLE IF EXISTS public.food_log_entries;

COMMIT;
