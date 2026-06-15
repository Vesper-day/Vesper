-- Migration 20 — chat 111 schema checkpoint (F1, F2, F3)
-- Block 1 incremental, suffix 20 (docs/MIGRATION_NUMBER_ALLOCATION.md, Blocks 4-7
-- range 14-30). Suffix 20 is the next integer free in BOTH packages/db/migrations/
-- (highest integer was 18; 4a is a letter slot) AND supabase/migrations/ (which
-- already uses 19 for start_of_local_day). 19 was NOT free.
-- Source: Chat 111 migration read-checkpoint, flags F1/F2/F3.
-- Forward-only per docs/MIGRATION_DISCIPLINE.md. Hand-written per
-- ARCHITECTURE_DECISIONS Decision 01 (no drizzle-kit generate).
-- Mirror of packages/db/migrations/20260601000020_chat111_schema_checkpoint.sql
-- (canonical pair, which also carries the matching .down.sql). This copy is what
-- `supabase db push` applies.
--
-- F1 (daily_plans): the evening draft->approved lifecycle had NO state column and
--     NO approved_at timestamp. Added forward (chats 025 & 046-W consume these).
-- F2 (medications): no respect_quiet_hours default-true existed (good — no silent
--     dose delay), but the explicit per-medication shift-out-of-quiet-hours OPT-IN
--     was absent. Added forward, default false = fire on time (chat 060 consumes).
-- F3 (referral_credits): the table was referrer-only (referral_event_enum has the
--     single value 'referee_converted'); two-sided credits were not representable.
--     users.referred_by_user_id already provides signup attribution (confirmed,
--     unchanged). Added a beneficiary_role to represent the referee's own credit
--     row; discount_percent already defaults 50, so the referee gets 50% off the
--     first paid month (chats 031 & 095-W consume this).

BEGIN;

-- F1 — daily_plans draft->approved lifecycle ---------------------------------
CREATE TYPE daily_plan_status_enum AS ENUM ('draft', 'approved');

-- NOT NULL DEFAULT 'draft': the default backfills existing rows in the same
-- statement, so no separate backfill pass is required.
ALTER TABLE public.daily_plans
  ADD COLUMN status daily_plan_status_enum NOT NULL DEFAULT 'draft';

ALTER TABLE public.daily_plans
  ADD COLUMN approved_at timestamptz;

-- Partial index for the "approved plans" read path (chats 025, 046-W).
CREATE INDEX idx_daily_plans_status
  ON public.daily_plans (user_id, status);

-- F2 — medications fire-on-time default + per-med shift opt-in ----------------
-- false = fire at the exact scheduled time (never silently delayed). Setting it
-- true is the explicit opt-in to shift this medication's dose out of quiet hours.
ALTER TABLE public.medications
  ADD COLUMN shift_out_of_quiet_hours boolean NOT NULL DEFAULT false;

-- F3 — two-sided referral credits --------------------------------------------
-- A new role column (not a new referral_event_enum value) keeps the change fully
-- reversible and avoids ALTER TYPE ... ADD VALUE (which cannot run inside a
-- transaction). 'referrer' is the default so existing rows stay valid; a
-- referee-role row is issued alongside the referrer row at conversion time, and
-- inherits the discount_percent default of 50 (50% off the referee's first paid
-- month).
CREATE TYPE referral_beneficiary_role_enum AS ENUM ('referrer', 'referee');

ALTER TABLE public.referral_credits
  ADD COLUMN beneficiary_role referral_beneficiary_role_enum NOT NULL DEFAULT 'referrer';

COMMIT;
