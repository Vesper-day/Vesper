-- Down migration 21 — notebook_inferences
-- Reverses 20260601000021_notebook_inferences.sql. Local-dev reset only.
-- Drop the table (cascades its policies, indexes, and set_updated_at trigger;
-- the shared set_updated_at() function from migration 13 is left intact), then
-- drop the enum type the dropped column depended on.

BEGIN;

DROP TABLE IF EXISTS public.notebook_inferences;

DROP TYPE IF EXISTS notebook_inference_state_enum;

COMMIT;
