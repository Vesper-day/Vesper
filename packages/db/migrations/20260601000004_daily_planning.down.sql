-- Down — Migration 4 (daily planning)
-- Reverses 20260601000004_daily_planning.sql. Local-dev / supabase db reset only.
-- Drop the block trigger and its function first, then tables in FK-reverse
-- order: blocks (-> daily_plans) before daily_plans; tasks and weekly_priorities
-- depend only on users. Indexes, policies, and REPLICA IDENTITY drop with tables.

BEGIN;

DROP TRIGGER IF EXISTS trg_blocks_touch_daily_plan ON public.blocks;
DROP FUNCTION IF EXISTS public.touch_daily_plan_on_block_change();

DROP TABLE IF EXISTS public.blocks;
DROP TABLE IF EXISTS public.tasks;
DROP TABLE IF EXISTS public.weekly_priorities;
DROP TABLE IF EXISTS public.daily_plans;

COMMIT;
