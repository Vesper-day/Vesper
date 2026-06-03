-- Migration 6 — modules (medications, recurring_errands, bills)
-- Block 1 foundation, suffix 6 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 tables 9-11 (Migration Sequence step 6).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- medications (§3 table 9) ---------------------------------------------------
-- Most sensitive table in the schema. Strictest RLS; audit trigger attached in
-- migration 11. Never synced to health platforms, never shared with third
-- parties.
CREATE TABLE public.medications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  dose       text NOT NULL,
  frequency  medication_frequency_enum NOT NULL,
  times      time[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL,
  end_date   date CHECK (end_date IS NULL OR end_date >= start_date),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_medications_user_id
  ON public.medications (user_id);

-- recurring_errands (§3 table 10) --------------------------------------------
CREATE TABLE public.recurring_errands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  frequency         errand_frequency_enum NOT NULL,
  day_of_week       integer CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  estimated_minutes integer NOT NULL CHECK (estimated_minutes > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_errands_user_id
  ON public.recurring_errands (user_id);

-- bills (§3 table 11) --------------------------------------------------------
-- Reminder-based only; never connects to financial institutions.
CREATE TABLE public.bills (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  amount            numeric(10,2),
  due_day_of_month  integer CHECK (due_day_of_month IS NULL OR due_day_of_month BETWEEN 1 AND 31),
  frequency         bill_frequency_enum NOT NULL,
  category          text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bills_user_id
  ON public.bills (user_id);
CREATE INDEX idx_bills_user_id_due_day
  ON public.bills (user_id, due_day_of_month);

-- Row Level Security ---------------------------------------------------------
-- Standard own-row pattern on all three (§3 Conventions).
ALTER TABLE public.medications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_errands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills             ENABLE ROW LEVEL SECURITY;

-- medications
CREATE POLICY medications_select_own ON public.medications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY medications_insert_own ON public.medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY medications_update_own ON public.medications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY medications_delete_own ON public.medications
  FOR DELETE USING (auth.uid() = user_id);

-- recurring_errands
CREATE POLICY recurring_errands_select_own ON public.recurring_errands
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY recurring_errands_insert_own ON public.recurring_errands
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY recurring_errands_update_own ON public.recurring_errands
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY recurring_errands_delete_own ON public.recurring_errands
  FOR DELETE USING (auth.uid() = user_id);

-- bills
CREATE POLICY bills_select_own ON public.bills
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY bills_insert_own ON public.bills
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY bills_update_own ON public.bills
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY bills_delete_own ON public.bills
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
