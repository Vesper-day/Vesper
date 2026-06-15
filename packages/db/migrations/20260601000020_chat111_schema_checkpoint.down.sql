-- Down — Migration 20 (chat 111 schema checkpoint)
-- Reverses 20260601000020_chat111_schema_checkpoint.sql. Local-dev / supabase db
-- reset only (not production). Drops columns first, then the enum types they used.

BEGIN;

-- F3
ALTER TABLE public.referral_credits DROP COLUMN IF EXISTS beneficiary_role;
DROP TYPE IF EXISTS referral_beneficiary_role_enum;

-- F2
ALTER TABLE public.medications DROP COLUMN IF EXISTS shift_out_of_quiet_hours;

-- F1
DROP INDEX IF EXISTS idx_daily_plans_status;
ALTER TABLE public.daily_plans DROP COLUMN IF EXISTS approved_at;
ALTER TABLE public.daily_plans DROP COLUMN IF EXISTS status;
DROP TYPE IF EXISTS daily_plan_status_enum;

COMMIT;
