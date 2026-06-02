-- Migration 5 — templates (workout_templates, recipe_templates)
-- Block 1 foundation, suffix 5 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 tables 7-8 (Migration Sequence step 5).
-- Reference data, not user-owned: public SELECT, service-role-only writes.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- workout_templates (§3 table 7) ---------------------------------------------
-- ~150 seeded rows. Mutations occur via seed migrations under the service role.
CREATE TABLE public.workout_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  goal_tags        text[] NOT NULL DEFAULT '{}',
  equipment_tags   text[] NOT NULL DEFAULT '{}',
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (15, 30, 45, 60)),
  level            workout_level_enum NOT NULL,
  intensity_score  integer NOT NULL CHECK (intensity_score BETWEEN 1 AND 10),
  content          jsonb NOT NULL,
  source           text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- GIN for array containment during template filtering (§3 table 7 Indexes).
CREATE INDEX idx_workout_templates_goal_tags
  ON public.workout_templates USING gin (goal_tags);
CREATE INDEX idx_workout_templates_equipment_tags
  ON public.workout_templates USING gin (equipment_tags);
CREATE INDEX idx_workout_templates_duration_level
  ON public.workout_templates (duration_minutes, level);
CREATE INDEX idx_workout_templates_intensity_score
  ON public.workout_templates (intensity_score);

-- recipe_templates (§3 table 8) ----------------------------------------------
-- ~300 seeded rows. total_minutes stored explicitly (rest/marinate time).
CREATE TABLE public.recipe_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  cuisine_tags  text[] NOT NULL DEFAULT '{}',
  diet_tags     text[] NOT NULL DEFAULT '{}',
  prep_minutes  integer NOT NULL CHECK (prep_minutes >= 0),
  cook_minutes  integer NOT NULL CHECK (cook_minutes >= 0),
  total_minutes integer NOT NULL CHECK (total_minutes >= 0),
  difficulty    recipe_difficulty_enum NOT NULL,
  macros        jsonb NOT NULL,
  servings      integer NOT NULL CHECK (servings > 0),
  ingredients   jsonb NOT NULL,
  instructions  jsonb NOT NULL,
  image_url     text,
  source        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_templates_cuisine_tags
  ON public.recipe_templates USING gin (cuisine_tags);
CREATE INDEX idx_recipe_templates_diet_tags
  ON public.recipe_templates USING gin (diet_tags);
CREATE INDEX idx_recipe_templates_total_minutes
  ON public.recipe_templates (total_minutes);
CREATE INDEX idx_recipe_templates_difficulty
  ON public.recipe_templates (difficulty);

-- Row Level Security ---------------------------------------------------------
-- Reference data: all authenticated users read; no write policies, so
-- INSERT/UPDATE/DELETE are reachable only by the service role (§3 tables 7-8).
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_templates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY workout_templates_select_all ON public.workout_templates
  FOR SELECT USING (true);

CREATE POLICY recipe_templates_select_all ON public.recipe_templates
  FOR SELECT USING (true);

COMMIT;
