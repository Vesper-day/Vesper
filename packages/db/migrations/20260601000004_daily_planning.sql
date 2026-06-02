-- Migration 4 — daily planning (daily_plans, blocks, tasks, weekly_priorities)
-- Block 1 foundation, suffix 4 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 tables 3-6. Combined because these tables are
-- tightly coupled (§3 Migration Sequence step 4).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- daily_plans (§3 table 3) ---------------------------------------------------
-- One row per (user_id, plan_date). Plan history is not retained; regeneration
-- updates the row in place and replaces its blocks.
CREATE TABLE public.daily_plans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_date          date NOT NULL,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  energy_score       integer CHECK (energy_score BETWEEN 1 AND 10),
  regeneration_count integer NOT NULL DEFAULT 0,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

-- The UNIQUE (user_id, plan_date) btree also serves user-scoped lookups.
CREATE INDEX idx_daily_plans_plan_date
  ON public.daily_plans (plan_date);

-- blocks (§3 table 4) --------------------------------------------------------
-- user_id is denormalized from daily_plans so RLS evaluates on the row itself
-- without joining the parent.
CREATE TABLE public.blocks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_plan_id      uuid NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_time         timestamptz NOT NULL,
  end_time           timestamptz NOT NULL CHECK (end_time > start_time),
  block_type         block_type_enum NOT NULL,
  title              text NOT NULL,
  status             block_status_enum NOT NULL DEFAULT 'scheduled',
  details            jsonb NOT NULL DEFAULT '{}'::jsonb,
  source             block_source_enum NOT NULL,
  display_order      integer NOT NULL DEFAULT 0,
  -- carried in Realtime broadcasts; powers the 30s device self-mutation filter.
  client_mutation_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocks_daily_plan_id
  ON public.blocks (daily_plan_id);

CREATE INDEX idx_blocks_user_id_start_time
  ON public.blocks (user_id, start_time);

CREATE INDEX idx_blocks_user_id_status
  ON public.blocks (user_id, status);

CREATE INDEX idx_blocks_client_mutation_id
  ON public.blocks (client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- Server-side idempotency on block mutations (§3 table 4 Constraints).
-- Partial uniqueness requires a unique index, not a table constraint.
CREATE UNIQUE INDEX uq_blocks_user_id_client_mutation_id
  ON public.blocks (user_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

-- Realtime needs the full pre/post row (incl. client_mutation_id) so the
-- client self-mutation filter can match the mutation id (§3 table 4 Realtime).
ALTER TABLE public.blocks REPLICA IDENTITY FULL;

-- tasks (§3 table 5) ---------------------------------------------------------
CREATE TABLE public.tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  estimated_minutes integer NOT NULL CHECK (estimated_minutes > 0),
  deadline          timestamptz,
  priority          priority_enum NOT NULL DEFAULT 'medium',
  status            task_status_enum NOT NULL DEFAULT 'pending',
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id_status
  ON public.tasks (user_id, status);

CREATE INDEX idx_tasks_user_id_deadline
  ON public.tasks (user_id, deadline)
  WHERE deadline IS NOT NULL AND status != 'completed';

-- weekly_priorities (§3 table 6) ---------------------------------------------
-- Keyed by (user_id, week_start_date); week_start_date is always the Monday.
CREATE TABLE public.weekly_priorities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  priorities      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

-- Parent-touch trigger -------------------------------------------------------
-- Any block INSERT/UPDATE/DELETE bumps the parent daily_plans.updated_at. This
-- is the optimistic-concurrency source of truth for the plan-edit conflict
-- check (chat 027). Runs as the invoking user; the user owns both the block and
-- its parent plan (shared user_id), so the UPDATE satisfies daily_plans RLS.
CREATE OR REPLACE FUNCTION public.touch_daily_plan_on_block_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.daily_plans SET updated_at = now() WHERE id = OLD.daily_plan_id;
    RETURN OLD;
  ELSE
    UPDATE public.daily_plans SET updated_at = now() WHERE id = NEW.daily_plan_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_blocks_touch_daily_plan
  AFTER INSERT OR UPDATE OR DELETE ON public.blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_daily_plan_on_block_change();

-- Row Level Security ---------------------------------------------------------
-- Standard own-row pattern on all four tables (§3 Conventions). blocks checks
-- the denormalized user_id directly rather than joining daily_plans.
ALTER TABLE public.daily_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_priorities ENABLE ROW LEVEL SECURITY;

-- daily_plans
CREATE POLICY daily_plans_select_own ON public.daily_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY daily_plans_insert_own ON public.daily_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY daily_plans_update_own ON public.daily_plans
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY daily_plans_delete_own ON public.daily_plans
  FOR DELETE USING (auth.uid() = user_id);

-- blocks
CREATE POLICY blocks_select_own ON public.blocks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY blocks_insert_own ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY blocks_update_own ON public.blocks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY blocks_delete_own ON public.blocks
  FOR DELETE USING (auth.uid() = user_id);

-- tasks
CREATE POLICY tasks_select_own ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tasks_insert_own ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tasks_update_own ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY tasks_delete_own ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- weekly_priorities
CREATE POLICY weekly_priorities_select_own ON public.weekly_priorities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY weekly_priorities_insert_own ON public.weekly_priorities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY weekly_priorities_update_own ON public.weekly_priorities
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY weekly_priorities_delete_own ON public.weekly_priorities
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
