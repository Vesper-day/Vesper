-- Migration 25 — food_log_entries (Chat ADD-B, Nutrition module scaffold)
-- Block 4-7 additions, suffix 25 (docs/MIGRATION_NUMBER_ALLOCATION.md).
--   Used integer suffixes in the 14-30 block: 14,15,16,17,18,20,21,23,24
--   (19 skipped, 22 RETIRED, 25-30 free) -> next free integer = 25.
-- Source: PRD §6.3 (V1 nutrition module surface, method B) + docs/MODULE_MOUNT_CONTRACT.md.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- Up-only supabase mirror of packages/db/migrations/20260824000025_food_log_entries.sql
-- (the canonical pair). `supabase db push` applies this dir.
--
-- The daily food-log surface of the nutrition module. One row per logged food item.
-- The "today" read-back is derived by query against start_of_local_day(tz) (the same
-- day-boundary derivation the hydration counter uses, migration 14); there is no stored
-- daily total. DEEP nutrition columns (micronutrient / vitamin / RDA / calorie) are
-- DEFERRED (PRD §6.3) and intentionally NOT added here.

BEGIN;

CREATE TABLE public.food_log_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  logged_at          timestamptz NOT NULL DEFAULT now(),
  item_name          text NOT NULL,
  recipe_template_id uuid REFERENCES public.recipe_templates(id) ON DELETE SET NULL,
  quantity_note      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_food_log_entries_user_id_logged_at
  ON public.food_log_entries (user_id, logged_at);

CREATE TRIGGER set_updated_at_food_log_entries
  BEFORE UPDATE ON public.food_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.food_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY food_log_entries_select_own ON public.food_log_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY food_log_entries_insert_own ON public.food_log_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY food_log_entries_update_own ON public.food_log_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY food_log_entries_delete_own ON public.food_log_entries
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
