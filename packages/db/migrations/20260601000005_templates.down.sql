-- Down migration 5 — templates
-- Reverses 20260601000005_templates.sql. Local-dev reset only (not production).

BEGIN;

DROP TABLE IF EXISTS public.recipe_templates;
DROP TABLE IF EXISTS public.workout_templates;

COMMIT;
